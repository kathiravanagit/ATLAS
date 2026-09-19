#!/usr/bin/env python3
"""
Startup script for the backend.
Creates tables and seeds initial data.
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, Base
from models_db import (
    Case, Prediction, RankedLocation, Alert, Suspect,
    AuditLog, AtmLocation
)
from seed import create_tables, seed_data


def main():
    print("=" * 50)
    print("ATLAS — Advanced Threat Location & Alert System")
    print("=" * 50)
    
    print("\n[1/3] Creating database tables...")
    create_tables()
    
    print("[2/3] Seeding initial data...")
    seed_data()
    
    print("[3/3] Starting server...")
    print("=" * 50)
    
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
