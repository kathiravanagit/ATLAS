#!/usr/bin/env python3
"""Development/demo startup script for the backend."""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, Base
from seed import create_tables, seed_data


def main():
    print("=" * 50)
    print("ATLAS — Advanced Threat Location & Alert System")
    print("=" * 50)
    
    demo_mode = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")
    if demo_mode:
        print("\n[1/3] Creating demo database tables...")
        create_tables()
    else:
        print("\n[1/3] Applying database migrations...")
        from alembic import command
        from alembic.config import Config
        command.upgrade(Config("alembic.ini"), "head")

    if demo_mode:
        print("[2/3] Seeding demo data...")
        seed_data()
    else:
        print("[2/3] Skipping demo seed (production mode)...")
    
    print("[3/3] Starting server...")
    print("=" * 50)
    
    import uvicorn
    # Keep one server process so the frontend cannot remain attached to a stale
    # reloader child using a different environment or database.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
