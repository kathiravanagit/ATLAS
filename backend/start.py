#!/usr/bin/env python3
"""Development/demo startup script for the backend."""
import argparse
import os
from pathlib import Path
import random
import sys

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--setup-only", action="store_true",
        help="Apply migrations and optional demo seed without starting the server.",
    )
    args = parser.parse_args(argv)

    from database import DEMO_MODE, SessionLocal
    from alembic import command
    from alembic.config import Config

    ssl_certfile = os.getenv("SSL_CERTFILE", "").strip()
    ssl_keyfile = os.getenv("SSL_KEYFILE", "").strip()
    if not args.setup_only and bool(ssl_certfile) != bool(ssl_keyfile):
        parser.error("SSL_CERTFILE and SSL_KEYFILE must be configured together")

    print("=" * 50)
    print("ATLAS - Advanced Threat Location & Alert System")
    print("=" * 50)

    print("\n[1/3] Applying database migrations...")
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")

    if DEMO_MODE:
        print("[2/3] Seeding demo data...")
        from seed import seed_data
        from auth import seed_demo_users

        # Seed repeatable random choices without changing the server's RNG state.
        # Existing data is retained; timestamps still reflect the setup time.
        random_state = random.getstate()
        try:
            random.seed(0)
            seed_data()
        finally:
            random.setstate(random_state)
        with SessionLocal() as db:
            seed_demo_users(db)
    else:
        print("[2/3] Skipping demo seed (production mode)...")

    if args.setup_only:
        print("[3/3] Database setup complete (server not started).")
        return

    print("[3/3] Starting server...")
    print("=" * 50)
    ssl_kwargs = {}
    if ssl_certfile and ssl_keyfile:
        ssl_kwargs = {"ssl_certfile": ssl_certfile, "ssl_keyfile": ssl_keyfile}
        print(f"[ATLAS] TLS enabled - cert: {ssl_certfile}")
    else:
        print("[ATLAS] TLS not configured - serving local HTTP")

    import uvicorn
    # Keep one server process so the frontend cannot remain attached to a stale
    # reloader child using a different environment or database.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, **ssl_kwargs)  # nosec B104 (local demo entrypoint)


if __name__ == "__main__":
    main()
