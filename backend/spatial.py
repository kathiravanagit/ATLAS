"""
Spatial query layer with PostGIS support and haversine fallback.

When PostgreSQL + PostGIS is available:
  - Uses geometry columns with GIST spatial indexes
  - ST_DWithin for efficient radius queries
  - ST_Distance for accurate geodesic distance

When SQLite or PostGIS unavailable:
  - Falls back to haversine distance calculations
  - Bounding box pre-filter for performance
"""
import os
import numpy as np
from sqlalchemy import text, func, Column, Float
from sqlalchemy.orm import Session

USE_POSTGIS = False
_postgis_checked = False


def check_postgis(db: Session) -> bool:
    """Check if PostGIS extension is available and enabled."""
    global USE_POSTGIS, _postgis_checked
    if _postgis_checked:
        return USE_POSTGIS
    _postgis_checked = True
    try:
        result = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'postgis'"))
        if result.fetchone():
            USE_POSTGIS = True
            return True
    except Exception:
        pass
    USE_POSTGIS = False
    return False


def enable_postgis(db: Session) -> bool:
    """Enable PostGIS extension (requires superuser)."""
    global USE_POSTGIS, _postgis_checked
    try:
        db.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        db.commit()
        USE_POSTGIS = True
        _postgis_checked = True
        return True
    except Exception:
        db.rollback()
        return False


def add_geometry_column(db: Session, table: str = "atm_locations"):
    """Add PostGIS geometry column and spatial index to ATM locations table."""
    try:
        db.execute(text(f"""
            ALTER TABLE {table}
            ADD COLUMN IF NOT EXISTS geometry GEOMETRY(Point, 4326)
        """))
        db.execute(text(f"""
            UPDATE {table}
            SET geometry = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
            WHERE geometry IS NULL
        """))
        db.execute(text(f"""
            CREATE INDEX IF NOT EXISTS idx_{table}_geometry
            ON {table} USING GIST (geometry)
        """))
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate haversine distance in km between two points."""
    R = 6371.0
    lat1, lng1, lat2, lng2 = map(np.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


def bounding_box_filter(lat: float, lng: float, candidates: list, max_km: float = 50) -> list:
    """Pre-filter candidates using rectangular bounding box."""
    dlat = max_km / 111.0
    dlng = max_km / (111.0 * max(np.cos(np.radians(lat)), 0.01))
    min_lat, max_lat = lat - dlat, lat + dlat
    min_lng, max_lng = lng - dlng, lng + dlng
    return [
        c for c in candidates
        if min_lat <= c["latitude"] <= max_lat and min_lng <= c["longitude"] <= max_lng
    ]


def find_nearby_atms_postgis(
    db: Session,
    lat: float,
    lng: float,
    max_km: float = 50,
    limit: int = 8
) -> list:
    """
    Find nearby ATMs using PostGIS spatial index.

    Uses ST_DWithin for efficient radius search with GiST index.
    Returns list of (distance_km, atm_id, name, latitude, longitude, area).
    """
    query = text("""
        SELECT
            atm_id, name, latitude, longitude, area,
            ST_Distance(
                geometry::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
            ) / 1000.0 AS distance_km
        FROM atm_locations
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :max_meters
        )
        ORDER BY distance_km
        LIMIT :limit
    """)

    result = db.execute(query, {
        "lat": lat,
        "lng": lng,
        "max_meters": max_km * 1000,
        "limit": limit
    })

    return [
        {
            "atm_id": row[0],
            "name": row[1],
            "latitude": row[2],
            "longitude": row[3],
            "area": row[4],
            "distance_km": round(row[5], 2)
        }
        for row in result
    ]


def find_nearby_atms_haversine(
    db: Session,
    lat: float,
    lng: float,
    max_km: float = 50,
    limit: int = 8
) -> list:
    """
    Find nearby ATMs using haversine with bounding box pre-filter.

    Used as fallback when PostGIS is not available (SQLite or no extension).
    """
    from models_db import AtmLocation

    # Broad bounding box query (SQL-level pre-filter)
    dlat = max_km / 111.0
    dlng = max_km / (111.0 * max(np.cos(np.radians(lat)), 0.01))

    atms = db.query(AtmLocation).filter(
        AtmLocation.latitude.between(lat - dlat, lat + dlat),
        AtmLocation.longitude.between(lng - dlng, lng + dlng)
    ).all()

    results = []
    for atm in atms:
        dist = haversine_distance(lat, lng, atm.latitude, atm.longitude)
        if dist <= max_km:
            results.append({
                "atm_id": atm.atm_id,
                "name": atm.name,
                "latitude": atm.latitude,
                "longitude": atm.longitude,
                "area": atm.area,
                "distance_km": round(dist, 2)
            })

    results.sort(key=lambda x: x["distance_km"])
    return results[:limit]


def find_nearby_atms(
    db: Session,
    lat: float,
    lng: float,
    max_km: float = 50,
    limit: int = 8
) -> list:
    """
    Find nearby ATMs using the best available method.

    Automatically selects PostGIS (spatial index) or haversine fallback.
    """
    if USE_POSTGIS:
        return find_nearby_atms_postgis(db, lat, lng, max_km, limit)
    return find_nearby_atms_haversine(db, lat, lng, max_km, limit)


def get_spatial_info(db: Session) -> dict:
    """Return spatial engine status and capabilities."""
    return {
        "postgis_enabled": USE_POSTGIS,
        "spatial_index": USE_POSTGIS,
        "query_method": "PostGIS ST_DWithin + GiST index" if USE_POSTGIS else "Haversine + bounding box",
        "max_effective_radius_km": "unlimited" if USE_POSTGIS else 200,
    }
