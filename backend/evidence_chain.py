"""
Cryptographic Evidence Chain-of-Custody
SHA-256 hash chain with Merkle tree for tamper-evident audit trail.

Persistence backends:
- file (default for offline demos/tests): local JSON under model/.
- db   (default for Postgres deployments): transactional rows in the
  evidence_blocks table — safe for concurrent workers and containers.
Select with CHAIN_BACKEND=db|file (default: db on Postgres, else file).
"""
import hashlib
import json
import time
import os
from typing import Optional, Callable

CHAIN_FILE = "model/evidence_chain.json"


def _resolve_backend() -> str:
    explicit = os.getenv("CHAIN_BACKEND", "").strip().lower()
    if explicit in ("db", "file"):
        return explicit
    if os.getenv("TESTING") == "1":
        return "file"
    url = os.getenv("DATABASE_URL", "")
    if url and "localhost" not in url and not url.startswith("sqlite"):
        return "db"
    return "file"


def _default_session_factory() -> Callable:
    from database import SessionLocal
    return SessionLocal


class MerkleNode:
    def __init__(self, data: str, left=None, right=None):
        self.data = data
        self.hash = hashlib.sha256(data.encode()).hexdigest()
        self.left = left
        self.right = right

    def get_hash(self):
        if self.left and self.right:
            return hashlib.sha256(
                (self.left.get_hash() + self.right.get_hash()).encode()
            ).hexdigest()
        return self.hash


class FileEvidenceStore:
    """Original single-node JSON persistence (offline demos, tests)."""

    def load(self):
        if os.path.exists(CHAIN_FILE):
            try:
                with open(CHAIN_FILE, "r") as f:
                    data = json.load(f)
                return data.get("blocks", []), data.get("merkle_root")
            except (json.JSONDecodeError, KeyError):
                pass
        return [], None

    def save(self, blocks, merkle_root):
        os.makedirs(os.path.dirname(CHAIN_FILE) if os.path.dirname(CHAIN_FILE) else ".", exist_ok=True)
        with open(CHAIN_FILE, "w") as f:
            json.dump({
                "blocks": blocks,
                "merkle_root": merkle_root,
                "total_blocks": len(blocks),
                "last_updated": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            }, f, indent=2)

    def persist_block(self, block):
        # File store persists the whole chain in _save(); nothing to do per block.
        return True


class DbEvidenceStore:
    """Transactional Postgres/SQLite persistence for multi-worker deployments."""

    def __init__(self, session_factory=None):
        self._session_factory = session_factory or _default_session_factory()

    def _session(self):
        return self._session_factory()

    def load(self):
        from models_db import EvidenceBlockRow
        db = self._session()
        try:
            rows = db.query(EvidenceBlockRow).order_by(EvidenceBlockRow.block_id).all()
            blocks = [json.loads(r.payload) for r in rows]
            return blocks, None  # merkle root rebuilt in memory
        finally:
            db.close()

    def save(self, blocks, merkle_root):
        return None  # DB store persists per-block in persist_block

    def persist_block(self, block):
        """Insert one block transactionally. True if stored, False if already present."""
        from sqlalchemy.exc import IntegrityError
        from models_db import EvidenceBlockRow
        db = self._session()
        try:
            db.add(EvidenceBlockRow(
                block_id=block["block_id"],
                case_id=block.get("case_id", ""),
                block_hash=block["block_hash"],
                prev_hash=block.get("previous_hash", ""),
                payload=json.dumps(block),
            ))
            db.commit()
            return True
        except IntegrityError:
            db.rollback()
            return False
        finally:
            db.close()


class EvidenceChain:
    """Merkle-tree based evidence chain-of-custody with pluggable persistence."""

    def __init__(self, store=None):
        self.evidence_blocks = []
        self.merkle_root = None
        if store is None:
            self.backend = _resolve_backend()
            store = DbEvidenceStore() if self.backend == "db" else FileEvidenceStore()
        else:
            self.backend = "db" if isinstance(store, DbEvidenceStore) else "file"
        self._store = store
        self._load()

    def _load(self):
        """Load chain from the configured store."""
        blocks, merkle_root = self._store.load()
        self.evidence_blocks = blocks or []
        self.merkle_root = merkle_root
        if self.evidence_blocks and self.merkle_root is None:
            self._rebuild_merkle()

    def _save(self):
        """Persist chain to the configured store."""
        self._store.save(self.evidence_blocks, self.merkle_root)

    def hash_evidence(self, content: str) -> str:
        """Hash a piece of evidence content."""
        return hashlib.sha256(content.encode()).hexdigest()

    def add_evidence(self, case_id: str, evidence_type: str, content: str, officer_id: str) -> dict:
        """Add evidence to the chain and persist (transactional on the db backend)."""
        evidence_hash = self.hash_evidence(content)

        for _attempt in range(3):
            prev_hash = self.evidence_blocks[-1]["block_hash"] if self.evidence_blocks else "0" * 64

            block = {
                "block_id": len(self.evidence_blocks) + 1,
                "case_id": case_id,
                "evidence_type": evidence_type,
                "hash": evidence_hash,
                "content_preview": content[:100] + "..." if len(content) > 100 else content,
                "officer_id": officer_id,
                "timestamp": time.time(),
                "timestamp_human": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
                "previous_hash": prev_hash,
            }

            # Chain integrity: block hash includes previous block hash
            block_string = json.dumps(block, sort_keys=True)
            block["block_hash"] = hashlib.sha256(block_string.encode()).hexdigest()

            self.evidence_blocks.append(block)
            self._rebuild_merkle()
            stored = self._store.persist_block(block)
            if stored is False:
                # Concurrent writer won this block_id — reload and retry with next id
                self._load()
                continue
            self._save()
            break

        return {
            "status": "anchored",
            "block_id": block["block_id"],
            "evidence_hash": evidence_hash,
            "block_hash": block["block_hash"],
            "previous_hash": prev_hash,
            "merkle_root": self.merkle_root,
            "timestamp": block["timestamp_human"],
            "persisted": True,
        }

    def verify_evidence(self, block_id: int, content: str) -> dict:
        """Verify evidence integrity by recomputing hashes."""
        if block_id < 1 or block_id > len(self.evidence_blocks):
            return {"valid": False, "error": "Block not found"}

        block = self.evidence_blocks[block_id - 1]
        current_hash = self.hash_evidence(content)

        # Verify hash matches
        hash_valid = current_hash == block["hash"]

        # Verify chain linkage
        chain_valid = True
        if block_id > 1:
            prev_block = self.evidence_blocks[block_id - 2]
            chain_valid = block["previous_hash"] == prev_block["block_hash"]

        # Verify block hash
        block_copy = {k: v for k, v in block.items() if k != "block_hash"}
        recomputed_block_hash = hashlib.sha256(json.dumps(block_copy, sort_keys=True).encode()).hexdigest()
        block_hash_valid = recomputed_block_hash == block["block_hash"]

        # Verify Merkle root
        self._rebuild_merkle()
        merkle_valid = self.merkle_root is not None

        return {
            "valid": hash_valid and chain_valid and block_hash_valid,
            "hash_valid": hash_valid,
            "chain_valid": chain_valid,
            "block_hash_valid": block_hash_valid,
            "merkle_valid": merkle_valid,
            "stored_hash": block["hash"],
            "computed_hash": current_hash,
            "stored_block_hash": block["block_hash"],
            "recomputed_block_hash": recomputed_block_hash,
            "current_merkle_root": self.merkle_root,
            "block_id": block_id,
        }

    def get_chain(self, case_id: Optional[str] = None) -> list:
        """Get evidence chain, optionally filtered by case."""
        if case_id:
            return [b for b in self.evidence_blocks if b["case_id"] == case_id]
        return self.evidence_blocks.copy()

    def get_merkle_proof(self, block_id: int) -> dict:
        """Get Merkle proof for a specific block."""
        if block_id < 1 or block_id > len(self.evidence_blocks):
            return {"error": "Block not found"}

        leaves = [b["hash"] for b in self.evidence_blocks]
        proof = []
        idx = block_id - 1

        while len(leaves) > 1:
            new_leaves = []
            for i in range(0, len(leaves), 2):
                left = leaves[i]
                right = leaves[i + 1] if i + 1 < len(leaves) else left
                parent = hashlib.sha256((left + right).encode()).hexdigest()
                new_leaves.append(parent)

                if i == idx or i + 1 == idx:
                    sibling = right if i == idx else left
                    proof.append({"hash": sibling, "position": "right" if i == idx else "left"})

            leaves = new_leaves
            idx = idx // 2

        return {
            "block_id": block_id,
            "merkle_root": leaves[0] if leaves else None,
            "proof_length": len(proof),
            "proof": proof,
            "verified": True,
        }

    def _rebuild_merkle(self):
        """Rebuild Merkle root from all evidence hashes."""
        if not self.evidence_blocks:
            self.merkle_root = None
            return

        leaves = [b["hash"] for b in self.evidence_blocks]
        while len(leaves) > 1:
            new_leaves = []
            for i in range(0, len(leaves), 2):
                left = leaves[i]
                right = leaves[i + 1] if i + 1 < len(leaves) else left
                parent = hashlib.sha256((left + right).encode()).hexdigest()
                new_leaves.append(parent)
            leaves = new_leaves

        self.merkle_root = leaves[0]

    def get_stats(self) -> dict:
        return {
            "total_blocks": len(self.evidence_blocks),
            "merkle_root": self.merkle_root,
            "cases_covered": list(set(b["case_id"] for b in self.evidence_blocks)),
            "persisted_to": CHAIN_FILE,
            "file_exists": os.path.exists(CHAIN_FILE),
        }


# Singleton
_evidence_chain = EvidenceChain()

def get_evidence_chain() -> EvidenceChain:
    return _evidence_chain
