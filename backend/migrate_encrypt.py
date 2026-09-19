"""
Migrate existing sensitive data to AES-256-GCM encrypted form.

Run once after setting ENCRYPTION_KEY in .env:
    python migrate_encrypt.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from encryption import is_encrypted, encrypt, decrypt
from database import engine, get_db
from models_db import Case, Suspect, Alert, AuditLog

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")

# Fields that contain PII / sensitive investigation data
ENCRYPT_FIELDS = {
    Case: ["victim_name", "contact", "description"],
    Suspect: ["name"],
    Alert: ["message"],
    AuditLog: ["details"],
}


def migrate():
    if not ENCRYPTION_KEY:
        print("ERROR: ENCRYPTION_KEY not set in .env — aborting migration.")
        sys.exit(1)

    db = next(get_db())
    total_encrypted = 0

    for model, fields in ENCRYPT_FIELDS.items():
        rows = db.query(model).all()
        for row in rows:
            for field in fields:
                val = getattr(row, field, None)
                if val and not is_encrypted(val):
                    encrypted = encrypt(val, ENCRYPTION_KEY)
                    setattr(row, field, encrypted)
                    total_encrypted += 1
        db.commit()

    print(f"Migration complete. {total_encrypted} fields encrypted.")


if __name__ == "__main__":
    migrate()
