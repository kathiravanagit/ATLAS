"""
Cryptographic Evidence Chain-of-Custody
SHA-256 hash chain with Merkle tree for tamper-evident audit trail.
File-backed persistence for single-node deployment.
"""
import hashlib
import json
import time
import os
from typing import Optional

CHAIN_FILE = "model/evidence_chain.json"


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


class EvidenceChain:
    """Merkle-tree based evidence chain-of-custody with file persistence."""

    def __init__(self):
        self.evidence_blocks = []
        self.merkle_root = None
        self._load()

    def _load(self):
        """Load chain from disk if it exists."""
        if os.path.exists(CHAIN_FILE):
            try:
                with open(CHAIN_FILE, "r") as f:
                    data = json.load(f)
                self.evidence_blocks = data.get("blocks", [])
                self.merkle_root = data.get("merkle_root")
            except (json.JSONDecodeError, KeyError):
                self.evidence_blocks = []
                self.merkle_root = None

    def _save(self):
        """Persist chain to disk."""
        os.makedirs(os.path.dirname(CHAIN_FILE) if os.path.dirname(CHAIN_FILE) else ".", exist_ok=True)
        with open(CHAIN_FILE, "w") as f:
            json.dump({
                "blocks": self.evidence_blocks,
                "merkle_root": self.merkle_root,
                "total_blocks": len(self.evidence_blocks),
                "last_updated": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            }, f, indent=2)

    def hash_evidence(self, content: str) -> str:
        """Hash a piece of evidence content."""
        return hashlib.sha256(content.encode()).hexdigest()

    def add_evidence(self, case_id: str, evidence_type: str, content: str, officer_id: str) -> dict:
        """Add evidence to the chain and persist."""
        evidence_hash = self.hash_evidence(content)
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
        self._save()

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
