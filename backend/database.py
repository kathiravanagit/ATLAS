from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Try PostgreSQL, fallback to SQLite
USE_SQLITE = False
USE_POSTGIS = False
if not DATABASE_URL or "localhost" in DATABASE_URL:
    USE_SQLITE = True

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
