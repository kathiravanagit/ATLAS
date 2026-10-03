from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")
TESTING = os.getenv("TESTING") == "1"

# Try PostgreSQL, fallback to SQLite
USE_SQLITE = False
USE_POSTGIS = False
if TESTING or DEMO_MODE or DATABASE_URL.startswith("sqlite"):
    USE_SQLITE = True
elif not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is required outside DEMO_MODE/TESTING. "
        "Configure PostgreSQL or explicitly use a sqlite:// URL for a local development database."
    )

if not USE_SQLITE and not DATABASE_URL.startswith("sqlite"):
    # Verify Postgres is actually reachable before committing to it.
    # (SQLite URLs take the file path directly — no probe needed.)
    try:
        _probe = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 5})
        with _probe.connect():
            pass
        _probe.dispose()
    except Exception as exc:
        raise RuntimeError(
            "Configured PostgreSQL is unreachable. Refusing to silently switch to SQLite "
            "because that could make the officer console display or write to the wrong database."
        ) from exc

if USE_SQLITE:
    DATABASE_URL = "sqlite:///./cybercrime_intel.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_engine(DATABASE_URL)
    # Check PostGIS availability
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'postgis'"))
            if result.fetchone():
                USE_POSTGIS = True
    except Exception:
        pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
