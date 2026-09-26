"""
ATLAS Blockchain — Proof-of-Work evidence ledger with multi-node consensus.
Not a smart-contract chain: purpose-built for tamper-evident law-enforcement
evidence custody (theme: Blockchain & Cybersecurity).

Features:
- SHA-256 PoW blocks (nonce mining, configurable difficulty)
- Merkle root over block transactions
- Simulated multi-node network + longest-chain consensus
- Pluggable persistence: local JSON file (offline demos/tests) or
  transactional Postgres rows (multi-worker deployments).
  Select with CHAIN_BACKEND=db|file (default: db on Postgres, else file).
"""
import hashlib
import json
import os
import threading
import time
from typing import Optional, Callable

CHAIN_FILE = "model/atlas_chain.json"
DEFAULT_DIFFICULTY = 3  # leading hex zeros required
MIN_DIFFICULTY = 1
GENESIS_PREV = "0" * 64
# Fixed genesis so every node derives an identical first block (no startup fork).
GENESIS_TIMESTAMP = 1735689600.0  # 2025-01-01T00:00:00Z
GENESIS_NOTE = "ATLAS-GENESIS-v1"

DEFAULT_NODES = [
    "node-cybercell-mumbai",
    "node-cybercell-delhi",
    "node-cybercell-bangalore",
]


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


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


def merkle_root(hashes: list) -> Optional[str]:
    if not hashes:
        return None
    layer = list(hashes)
    while len(layer) > 1:
        if len(layer) % 2 == 1:
            layer.append(layer[-1])
        layer = [
            _sha256(layer[i] + layer[i + 1])
            for i in range(0, len(layer), 2)
        ]
    return layer[0]


class Block:
    def __init__(
        self,
        index: int,
        transactions: list,
        previous_hash: str,
        nonce: int = 0,
        timestamp: Optional[float] = None,
        miner: str = "atlas-miner-0",
        difficulty: int = DEFAULT_DIFFICULTY,
        evidence_block_ids: Optional[list] = None,
    ):
        self.index = index
        self.transactions = transactions
        self.previous_hash = previous_hash
        self.nonce = nonce
        self.timestamp = timestamp if timestamp is not None else time.time()
        self.miner = miner
        self.difficulty = difficulty
        self.evidence_block_ids = evidence_block_ids or []
        self.hash = self.compute_hash()

    def compute_hash(self) -> str:
        payload = {
            "index": self.index,
            "transactions": self.transactions,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
            "timestamp": self.timestamp,
            "miner": self.miner,
            "difficulty": self.difficulty,
            "evidence_block_ids": self.evidence_block_ids,
            "merkle_root": merkle_root([t.get("tx_hash", "") for t in self.transactions]),
        }
        return _sha256(json.dumps(payload, sort_keys=True))

    def mine(self) -> int:
        if self.difficulty < MIN_DIFFICULTY:
            raise ValueError("difficulty must be >= 1")
        target = "0" * self.difficulty
        start = time.time()
        while not self.hash.startswith(target):
            self.nonce += 1
            self.hash = self.compute_hash()
        return int((time.time() - start) * 1000)

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "timestamp_human": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(self.timestamp)),
            "transactions": self.transactions,
            "tx_count": len(self.transactions),
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
            "hash": self.hash,
            "miner": self.miner,
            "difficulty": self.difficulty,
            "merkle_root": merkle_root([t.get("tx_hash", "") for t in self.transactions]),
            "evidence_block_ids": self.evidence_block_ids,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Block":
        block = cls(
            index=d["index"],
            transactions=d.get("transactions", []),
            previous_hash=d["previous_hash"],
            nonce=d.get("nonce", 0),
            timestamp=d.get("timestamp"),
            miner=d.get("miner", "atlas-miner-0"),
            difficulty=d.get("difficulty", DEFAULT_DIFFICULTY),
            evidence_block_ids=d.get("evidence_block_ids", []),
        )
        block.hash = d.get("hash", block.compute_hash())
        return block


class Blockchain:
    def __init__(self, node_id: str = "node-0", difficulty: int = DEFAULT_DIFFICULTY, persist: bool = True,
                 backend: str = "auto", session_factory=None, chain_name: str = "primary"):
        self.node_id = node_id
        self.difficulty = max(int(difficulty), MIN_DIFFICULTY)
        self.persist = persist
        self.chain_name = chain_name
        if backend == "auto":
            backend = _resolve_backend()
        self.backend = backend
        self._session_factory = session_factory
        self.chain: list[Block] = []
        self.pending: list[dict] = []
        self._lock = threading.Lock()
        if persist:
            if backend == "db":
                self._load_db()
            elif os.path.exists(CHAIN_FILE):
                self._load()
        if not self.chain:
            self._create_genesis()

    def _create_genesis(self):
        # Deterministic payload → identical genesis hash on every node/restart.
        genesis = Block(
            index=0,
            transactions=[{
                "tx_type": "genesis",
                "tx_hash": _sha256(GENESIS_NOTE),
                "payload": {"note": GENESIS_NOTE},
            }],
            previous_hash=GENESIS_PREV,
            timestamp=GENESIS_TIMESTAMP,
            miner="atlas-genesis",
            difficulty=self.difficulty,
        )
        genesis.mine()
        self.chain = [genesis]
        if self.persist:
            self._save()

    @property
    def last_block(self) -> Block:
        return self.chain[-1]

    def add_transaction(
        self,
        tx_type: str,
        payload: dict,
        case_id: str = "",
        evidence_block_id: Optional[int] = None,
    ) -> dict:
        tx_hash = _sha256(json.dumps({"type": tx_type, "payload": payload, "ts": time.time()}, sort_keys=True))
        tx = {
            "tx_type": tx_type,
            "tx_hash": tx_hash,
            "case_id": case_id,
            "payload": payload,
            "timestamp": time.time(),
        }
        with self._lock:
            self.pending.append(tx)
            pending_count = len(self.pending)
        return {"status": "queued", "tx_hash": tx_hash, "pending": pending_count}

    def mine_pending(self, miner: Optional[str] = None) -> dict:
        with self._lock:
            if not self.pending:
                return {"status": "empty", "message": "No pending transactions", "pending": 0}

            miner = miner or self.node_id
            evidence_ids = [
                t["payload"].get("evidence_block_id")
                for t in self.pending
                if t["payload"].get("evidence_block_id") is not None
            ]
            block = Block(
                index=len(self.chain),
                transactions=self.pending.copy(),
                previous_hash=self.last_block.hash,
                miner=miner,
                difficulty=self.difficulty,
                evidence_block_ids=[e for e in evidence_ids if e is not None],
            )
            mining_ms = block.mine()
            self.chain.append(block)
            self.pending = []
            if self.persist:
                self._save()
            return {
                "status": "mined",
                "block_index": block.index,
                "block_hash": block.hash,
                "nonce": block.nonce,
                "mining_ms": mining_ms,
                "tx_count": len(block.transactions),
                "difficulty": self.difficulty,
                "miner": miner,
            }

    @staticmethod
    def validate_chain(chain_dicts: list) -> dict:
        if not chain_dicts:
            return {"valid": False, "error": "Empty chain"}

        prev_hash = GENESIS_PREV
        for i, d in enumerate(chain_dicts):
            block = Block.from_dict(d)
            if block.index != i:
                return {"valid": False, "error": f"Bad index at position {i} (block.index={block.index})"}
            if not isinstance(block.difficulty, int) or block.difficulty < MIN_DIFFICULTY:
                return {"valid": False, "error": f"Invalid difficulty at index {i}"}
            if block.compute_hash() != d.get("hash"):
                return {"valid": False, "error": f"Hash mismatch at index {i}"}
            if not block.hash.startswith("0" * block.difficulty):
                return {"valid": False, "error": f"PoW invalid at index {i}"}
            if d.get("previous_hash") != prev_hash:
                return {"valid": False, "error": f"Broken link at index {i}"}
            expected_merkle = merkle_root([t.get("tx_hash", "") for t in block.transactions])
            if d.get("merkle_root") and d["merkle_root"] != expected_merkle:
                return {"valid": False, "error": f"Merkle root mismatch at index {i}"}
            prev_hash = block.hash
        return {"valid": True, "height": len(chain_dicts)}

    def get_chain(self) -> list:
        return [b.to_dict() for b in self.chain]

    def get_status(self) -> dict:
        return {
            "node_id": self.node_id,
            "backend": self.backend,
            "height": len(self.chain),
            "difficulty": self.difficulty,
            "pending_transactions": len(self.pending),
            "last_block_hash": self.last_block.hash,
            "last_block_time": self.last_block.timestamp,
            "chain_valid": self.validate_chain(self.get_chain())["valid"],
            "total_transactions": sum(len(b.transactions) for b in self.chain),
        }

    def replace_chain(self, new_chain_dicts: list, allow_equal: bool = False) -> dict:
        validation = self.validate_chain(new_chain_dicts)
        if not validation["valid"]:
            return {"replaced": False, "reason": "Incoming chain invalid", **validation}
        with self._lock:
            new_len = len(new_chain_dicts)
            old_len = len(self.chain)
            new_head = new_chain_dicts[-1].get("hash") if new_chain_dicts else None
            old_head = self.last_block.hash if self.chain else None
            if new_len == old_len and new_head == old_head:
                return {"replaced": False, "reason": "Already on this chain"}
            if new_len < old_len or (new_len == old_len and not allow_equal):
                return {"replaced": False, "reason": "Incoming chain not longer"}
            self.chain = [Block.from_dict(d) for d in new_chain_dicts]
            if self.persist:
                self._save()
            return {"replaced": True, "height": len(self.chain)}

    def _session(self):
        factory = self._session_factory or _default_session_factory()
        return factory()

    def _save(self):
        if self.backend == "db":
            self._save_db()
        else:
            self._save_file()

    def _save_file(self):
        os.makedirs(os.path.dirname(CHAIN_FILE) or ".", exist_ok=True)
        payload = {
            "node_id": self.node_id,
            "difficulty": self.difficulty,
            "chain": [b.to_dict() for b in self.chain],
            "pending": self.pending,
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        }
        # Atomic write: never leave a half-written chain file on crash.
        tmp_path = CHAIN_FILE + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump(payload, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, CHAIN_FILE)

    def _save_db(self):
        """Persist only blocks not yet stored (transactional; converges on conflict)."""
        from sqlalchemy import func
        from sqlalchemy.exc import IntegrityError
        from models_db import BlockchainBlockRow
        db = self._session()
        try:
            stored_max = db.query(func.max(BlockchainBlockRow.block_index)).filter(
                BlockchainBlockRow.chain_name == self.chain_name).scalar()
            stored_max = stored_max if stored_max is not None else -1
            for block in self.chain:
                if block.index <= stored_max:
                    continue
                d = block.to_dict()
                db.add(BlockchainBlockRow(
                    chain_name=self.chain_name,
                    block_index=block.index,
                    block_hash=block.hash,
                    prev_hash=block.previous_hash,
                    payload=json.dumps(d),
                ))
            db.commit()
        except IntegrityError:
            # A concurrent miner won this height — adopt whatever is stored.
            db.rollback()
            self._load_db()
        finally:
            db.close()

    def _load_db(self):
        from models_db import BlockchainBlockRow
        db = self._session()
        try:
            rows = db.query(BlockchainBlockRow).filter(
                BlockchainBlockRow.chain_name == self.chain_name).order_by(
                BlockchainBlockRow.block_index).all()
            self.chain = [Block.from_dict(json.loads(r.payload)) for r in rows]
            self.pending = []
        except Exception:
            self.chain = []
            self.pending = []
        finally:
            db.close()

    def _load(self):
        try:
            with open(CHAIN_FILE) as f:
                data = json.load(f)
            chain = [Block.from_dict(d) for d in data.get("chain", [])]
            if not chain:
                raise ValueError("empty chain file")
            self.chain = chain
            self.pending = data.get("pending", [])
            self.difficulty = max(int(data.get("difficulty", self.difficulty)), MIN_DIFFICULTY)
        except (json.JSONDecodeError, KeyError, OSError, TypeError, ValueError):
            self.chain = []
            self.pending = []


class BlockchainNetwork:
    """Simulated multi-node network for longest-chain consensus demos."""

    def __init__(self, difficulty: int = DEFAULT_DIFFICULTY, persist: bool = True):
        self.difficulty = difficulty
        self.persist = persist
        self.nodes: dict[str, Blockchain] = {}
        for node_id in DEFAULT_NODES:
            self.nodes[node_id] = Blockchain(node_id=node_id, difficulty=difficulty, persist=False)

    def get_node(self, node_id: str) -> Blockchain:
        if node_id not in self.nodes:
            self.nodes[node_id] = Blockchain(node_id=node_id, difficulty=self.difficulty, persist=False)
        return self.nodes[node_id]

    def broadcast_tx(self, tx_type: str, payload: dict, case_id: str = "") -> list:
        results = []
        for node_id, node in self.nodes.items():
            results.append({"node_id": node_id, **node.add_transaction(tx_type, payload, case_id)})
        return results

    def mine_on(self, node_id: str, miner: Optional[str] = None) -> dict:
        node = self.get_node(node_id)
        return node.mine_pending(miner=miner or node_id)

    def consensus(self) -> dict:
        """Longest valid chain wins; all nodes adopt it."""
        candidates = []
        reports = []
        for node_id, node in self.nodes.items():
            chain = node.get_chain()
            validation = Blockchain.validate_chain(chain)
            reports.append({
                "node_id": node_id,
                "height": len(chain),
                "valid": validation["valid"],
                "last_hash": node.last_block.hash if node.chain else None,
            })
            if validation["valid"]:
                candidates.append((len(chain), node_id, chain))

        if not candidates:
            return {"consensus": False, "reason": "No valid chains", "nodes": reports}

        # Longest chain wins; equal-height forks tie-break on head hash (deterministic).
        candidates.sort(key=lambda c: (c[0], c[2][-1].get("hash", "")), reverse=True)
        height, winner_id, winner_chain = candidates[0]
        adoption = []
        for node_id, node in self.nodes.items():
            # allow_equal so equal-height forks adopt the deterministic winner
            result = node.replace_chain(winner_chain, allow_equal=True)
            adoption.append({"node_id": node_id, **result})

        heads = {n.last_block.hash for n in self.nodes.values() if n.chain}
        if len(heads) != 1:
            return {
                "consensus": False,
                "reason": "Nodes still diverged after adoption",
                "winner": winner_id,
                "agreed_height": height,
                "nodes": reports,
                "adoption": adoption,
            }

        return {
            "consensus": True,
            "winner": winner_id,
            "agreed_height": height,
            "nodes": reports,
            "adoption": adoption,
        }

    def status(self) -> dict:
        return {
            "difficulty": self.difficulty,
            "node_count": len(self.nodes),
            "nodes": [n.get_status() for n in self.nodes.values()],
            "consensus_reached": len({n.last_block.hash for n in self.nodes.values()}) == 1,
        }


_network: Optional[BlockchainNetwork] = None
_primary: Optional[Blockchain] = None


def get_blockchain() -> Blockchain:
    global _primary
    if _primary is None:
        _primary = Blockchain(node_id="node-cybercell-mumbai", difficulty=DEFAULT_DIFFICULTY, persist=True)
    return _primary


def get_network() -> BlockchainNetwork:
    global _network
    if _network is None:
        _network = BlockchainNetwork(difficulty=DEFAULT_DIFFICULTY, persist=True)
        primary = get_blockchain()
        _network.nodes[primary.node_id] = primary
    return _network
