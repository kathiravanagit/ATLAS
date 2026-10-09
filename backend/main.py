import os

from fastapi import FastAPI, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from database import engine, get_db, Base, USE_SQLITE, SessionLocal, USE_POSTGIS
from reliability import (
    idempotency_key_from, check_replay, store_replay,
    enqueue_notification, run_notification_worker,
)
from models_db import NotificationJob
from models_db import (
    Case, Prediction, RankedLocation, Alert, Suspect,
    AuditLog, AtmLocation, FieldOutcome, RefreshToken, IdempotencyKey,
    TransactionRecord, ReviewRecord
)
from models import (
    CaseResponse, PredictionResponse, PredictionLocationResponse,
    AlertResponse, DashboardStatsResponse
)
from ml_engine import predict_cashout, get_metadata, haversine, compute_shap_values, load_models
import ml_engine

# The legacy wrapper remains supported while the ML agent exposes structured
# ensemble explanations (actual base value, method, units and availability).
explain_cashout = getattr(ml_engine, "explain_cashout", None)
_model_fingerprint_cache: dict = {}

# In-memory cache for synthetic city prediction reads
_city_prediction_cache: dict = {}
_CITY_CACHE_TTL = 45.0
# Mirrors the city cache: full prediction lists are expensive (model inference
# per case), so cache briefly and invalidate on any write that changes them.
_predictions_cache: dict = {}
_PREDICTIONS_CACHE_TTL = 45.0


def _invalidate_prediction_caches():
    _city_prediction_cache.clear()
    _predictions_cache.clear()

# Pre-warm production models. Tests configure isolated, serial inference before
# the first prediction and do not need import-time estimator allocations.
if os.getenv("TESTING") != "1":
    try:
        load_models()
    except Exception as exc:
        logger.warning("Model pre-warm failed; predictions will 503 until models load: %s", exc)

from city_data import CITIES, get_city, get_all_cities, get_city_atms, get_city_stats
from evidence_chain import get_evidence_chain
from blockchain import get_blockchain, get_network, Blockchain
from auth import register_auth_routes, verify_token, require_permission, require_role, generate_csrf_token, ws_tracker, require_csrf, consume_ws_ticket
from spatial import find_nearby_atms, get_spatial_info, enable_postgis, add_geometry_column
from typing import List, Optional
import random
import uuid
from datetime import datetime, timedelta, timezone
import json
import time
import threading
import logging
import hashlib
from sms_client import send_sms_alert
from email_client import send_email_alert
from encryption import seal, unseal, install_runtime_encryption
from security_config import SECURITY_CONFIG
from access_control import require_case, visible_cases, visible_case_ids, visibility_filter, check_action

install_runtime_encryption()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("atlas")

# Seed demo users — demo builds only. Production startup must never create
# well-known credentials; provision officers out of band instead.
from auth import seed_demo_users, DEMO_MODE

# Development/demo and tests may create their isolated schema. Production
# deployments must run `alembic upgrade head` before starting the application.
if DEMO_MODE or os.getenv("TESTING") == "1":
    Base.metadata.create_all(bind=engine)

if DEMO_MODE:
    _db = next(get_db())
    try:
        seed_demo_users(_db)
    finally:
        try:
            _db.close()
        except Exception as exc:
            logger.debug("Seed session close failed: %s", exc)
else:
    logger.info("Demo user seeding skipped (DEMO_MODE off)")
if DEMO_MODE:
    import warnings
    warnings.warn("DEMO MODE enabled — rate limiting disabled. Do NOT use in production!", stacklevel=2)

# Signing and encryption keys are validated by security_config before startup.

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ATLAS — Advanced Threat Location & Alert System API",
    description="Law Enforcement Investigation Tool",
    version="5.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Background Token Cleanup ────────────────────────────────────────────────
import atexit

def _cleanup_expired_tokens():
    """Remove expired and revoked refresh tokens to prevent unbounded table growth."""
    try:
        _db = next(get_db())
        try:
            from datetime import datetime, timezone
            cutoff = datetime.now(timezone.utc)
            deleted = _db.query(RefreshToken).filter(
                (RefreshToken.expires_at < cutoff) | (RefreshToken.revoked == True)
            ).delete(synchronize_session=False)
            _db.commit()
            if deleted:
                print(f"[TokenCleanup] Removed {deleted} expired/revoked refresh tokens")
        finally:
            _db.close()
    except Exception as exc:
        logger.warning("Token cleanup pass failed; will retry next cycle: %s", exc)

def _token_cleanup_loop():
    """Run token cleanup every 10 minutes in background."""
    import time as _time
    while True:
        _time.sleep(600)
        _cleanup_expired_tokens()

# Tests own short-lived databases and must not leave maintenance threads or
# exit callbacks trying to reopen a disposed fixture database.
if os.getenv("TESTING") != "1":
    _cleanup_thread = threading.Thread(target=_token_cleanup_loop, daemon=True)
    _cleanup_thread.start()
    atexit.register(_cleanup_expired_tokens)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
ENCRYPTION_KEY = SECURITY_CONFIG.encryption_key
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)

# Register auth routes
register_auth_routes(app)


# ─── Security Headers Middleware ──────────────────────────────────────────────

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        # Production bundle ships no eval/Function-constructor and no inline
        # scripts (verified against dist/) — drop both unsafe directives.
        "script-src 'self'; "
        # 'unsafe-inline' still required for React inline style attributes;
        # leaflet.css (unpkg) + Google Fonts are the only external assets.
        "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; "
        "img-src 'self' data: https://*.tile.openstreetmap.org https://unpkg.com; "
        "connect-src 'self' ws: wss:; "
        "font-src 'self' https://fonts.gstatic.com; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    return response


@app.middleware("http")
async def api_version_prefix(request: Request, call_next):
    """Foundation for versioned integration: /api/v1/* serves the current API."""
    path = request.url.path
    if path == "/api/v1" or path.startswith("/api/v1/"):
        # Strip only the /v1 segment so /api/v1/cases -> /api/cases.
        stripped = "/api" + path[len("/api/v1"):] or "/api/"
        request.scope["path"] = stripped
        request.scope["raw_path"] = stripped.encode()
    return await call_next(request)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Attach a request ID for log correlation; echo it back to the caller."""
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Never leak tracebacks / internals to API clients; log with request ID."""
    logger.error(f"Unhandled error [{getattr(request.state, 'request_id', '-')}] {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    start = time.time()
    response = await call_next(request)
    elapsed = round((time.time() - start) * 1000)
    status = response.status_code
    method = request.method
    path = request.url.path
    if status >= 500:
        logger.error(f"{method} {path} → {status} ({elapsed}ms)")
    elif status >= 400:
        logger.warning(f"{method} {path} → {status} ({elapsed}ms)")
    elif status == 200 or status == 201:
        logger.info(f"{method} {path} → {status} ({elapsed}ms)")
    else:
        logger.info(f"{method} {path} → {status} ({elapsed}ms)")
    return response


# ─── CSRF Token Endpoint ──────────────────────────────────────────────────────

@app.get("/api/csrf-token")
def get_csrf_token(user: dict = Depends(verify_token)):
    token = generate_csrf_token(user["id"])
    return {"csrf_token": token, "expires_in": 3600}


# ─── Request Models ───────────────────────────────────────────────────────────

import re
CASE_ID_PATTERN = re.compile(r'^[A-Z]{2,4}-\d{4}-\d{3,5}$')

class TransactionCreate(BaseModel):
    # Strict bounds: a single bad request must never corrupt a real case
    # (negative/zero/Inf/NaN amounts previously poisoned cases.amount and
    # broke every downstream reader with 500s).
    case_id: str = Field(min_length=3, max_length=40)
    amount: float = Field(gt=0, le=10_000_000, allow_inf_nan=False)
    from_account: str = Field(min_length=1, max_length=64)
    to_account: str = Field(min_length=1, max_length=64)
    atm_id: Optional[str] = Field(default=None, max_length=32)
    location: Optional[str] = Field(default=None, max_length=120)

class AlertCreate(BaseModel):
    case_id: str
    message: str
    risk_level: str
    location: str
    time_window: str


def stable_int(value: str) -> int:
    """Return a process-independent integer for reproducible synthetic fixtures."""
    return int.from_bytes(hashlib.sha256(value.encode("utf-8")).digest()[:4], "big")


def ensure_synthetic_transactions(db: Session, case_id: str, city_id: str, atms: list) -> list:
    """Create and query synthetic records once; prediction signals come from DB rows."""
    records = db.query(TransactionRecord).filter(TransactionRecord.case_id == case_id).all()
    if records:
        return records

    # Transaction records are children of cases. City-generated and direct
    # prediction requests can use synthetic IDs that are not seeded yet.
    if not db.query(Case).filter(Case.case_id == case_id).first():
        db.add(Case(
            case_id=case_id,
            crime_type="Synthetic prediction fixture",
            amount=0,
            linked_accounts=0,
            current_risk="Medium",
            status="active",
            victim_name="SYNTHETIC-VICTIM",
            contact="SYNTHETIC-ONLY",
            description=f"Persisted synthetic prediction fixture for {city_id}",
        ))
        db.flush()

    seed = stable_int(f"{case_id}:{city_id}")
    base_time = datetime(2026, 9, 1, 17, tzinfo=timezone.utc)
    for index in range(12):
        atm = atms[(seed + index) % len(atms)]
        amount = float(12000 + ((seed + index * 7919) % 118000))
        db.add(TransactionRecord(
            case_id=case_id,
            from_account=f"SYN-SRC-{(seed + index) % 97:03d}",
            to_account=f"SYN-MULE-{(seed + index * 3) % 97:03d}",
            amount=amount,
            atm_id=atm.get("id") if hasattr(atm, "get") else getattr(atm, "atm_id", ""),
            location=atm.get("name") if hasattr(atm, "get") else getattr(atm, "name", ""),
            occurred_at=base_time + timedelta(hours=(seed + index) % 18),
            source="synthetic-fixture",
        ))
    db.commit()
    return db.query(TransactionRecord).filter(TransactionRecord.case_id == case_id).all()


def _predict_or_503(features: dict, case_id: str = "") -> dict:
    try:
        result = predict_cashout(features, case_id=case_id)
        if not isinstance(result, dict) or result.get("error") or "risk_score" not in result or "confidence" not in result:
            raise ValueError("Model returned no usable prediction")
        import math
        if not all(math.isfinite(float(result[key])) for key in ("risk_score", "confidence")):
            raise ValueError("Model returned non-finite scores")
        result = dict(result)
        result["drift"] = {
            **(result.get("drift") or {}),
            "metric_method": "per-feature z-score heuristic; not PSI",
            "data_source": "synthetic training reference; not verified live drift",
            "verified": False,
        }
        return result
    except Exception as exc:
        logger.error("Prediction model unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Prediction model unavailable; no risk estimate was produced") from exc


def _persist_prediction(db, result):
    try:
        pred = db.query(Prediction).filter(Prediction.case_id == result["case_id"]).first()
        if pred is None:
            pred = Prediction(case_id=result["case_id"])
            db.add(pred)
            db.flush()
        pred.status = result["status"]
        pred.risk_trend = json.dumps(result["risk_trend"])
        pred.model_version = result.get("model_info", {}).get("model_version", "unversioned")
        db.query(RankedLocation).filter(RankedLocation.prediction_id == pred.id).delete()
        for location in result["ranked_locations"]:
            # Existing encrypted Text field avoids a schema change. Responses
            # keep the human-readable reason separate from this exact snapshot.
            snapshot = json.dumps({
                "snapshot_version": 1, "reason": location["reason"],
                "prediction_features": location["prediction_features"],
                "model_output": location["model_output"],
                "model_info": location["model_info"],
            })
            db.add(RankedLocation(
                prediction_id=pred.id, reason=snapshot,
                **{key: location[key] for key in (
                    "rank", "atm_id", "location_name", "risk_score", "expected_window",
                    "distance", "status", "latitude", "longitude",
                )},
            ))
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Could not persist exact prediction snapshot: %s", exc)
        raise HTTPException(status_code=503, detail="Prediction snapshot could not be persisted") from exc


def _current_model_fingerprint():
    import joblib
    try:
        rf, xgb = load_models()
        if rf is None and xgb is None:
            raise ValueError("No models loaded")
        background = (get_metadata() or {}).get("shap_background")
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Prediction model unavailable") from exc
    key = (id(rf), id(xgb), joblib.hash(background))
    cached = _model_fingerprint_cache.get(key)
    if cached and cached[0] is rf and cached[1] is xgb:
        return cached[2]
    fingerprint = joblib.hash((rf, xgb, background))
    if len(_model_fingerprint_cache) >= 4:
        _model_fingerprint_cache.clear()
    _model_fingerprint_cache[key] = (rf, xgb, fingerprint)
    return fingerprint


def _location_model_info(output):
    return {
        "model_version": output.get("model_version", "unversioned"),
        "model_fingerprint": _current_model_fingerprint(),
        "model_weights": output.get("model_weights", {}),
        "data_source": "synthetic operational simulation; not verified historical evidence",
    }


def _label_simulated_evidence(evidence):
    for item in evidence.values():
        item["data_source"] = "simulated, not verified"
        item["description"] = "Simulated (not verified): " + item["description"]
        item["details"] = "Simulated (not verified): " + item["details"]
    return evidence


# ─── Risk Scoring Engine (ML-powered) ─────────────────────────────────────────

def get_predictions_for_case(case_id: str, db: Session) -> dict:
    _current_model_fingerprint()  # fail before creating synthetic fixtures
    case = db.query(Case).filter(Case.case_id == case_id).first()

    case_hash = stable_int(case_id) % 10000
    random.seed(case_hash)

    atm_locations = db.query(AtmLocation).all()
    if not atm_locations:
        raise HTTPException(status_code=503, detail="Prediction service unavailable: no ATM reference data")

    # Determine city from case alerts/description, default to puducherry
    city_id = "puducherry"
    if case:
        desc = (case.description or "").upper()
        for cid, cdata in CITIES.items():
            if cdata["name"].upper() in desc:
                city_id = cid
                break
    city = CITIES.get(city_id, CITIES["puducherry"])
    city_center = city["center"]

    # Filter ATMs to only those in the selected city (by ID prefix)
    city_prefix = {"puducherry": "PNY", "chennai": "CHN", "delhi": "DEL", "mumbai": "MUM",
                   "bangalore": "BLR", "kolkata": "KOL", "hyderabad": "HYD", "ahmedabad": "AMD"}
    prefix = city_prefix.get(city_id, "PNY")
    city_atms = [atm for atm in atm_locations if atm.atm_id.startswith(prefix)]
    if not city_atms:
        city_atms = atm_locations  # fallback to all if no match
    synthetic_records = ensure_synthetic_transactions(db, case_id, city_id, city_atms)
    record_total = sum(record.amount for record in synthetic_records)
    record_accounts = len({record.to_account for record in synthetic_records})

    model_meta = get_metadata()
    model_accuracy = model_meta.get("accuracy") if model_meta else None

    # Deterministic victim/suspect positions derived from case_id hash
    victim_offset_x = ((case_hash * 7 + 3) % 200 - 100) / 10000.0
    victim_offset_y = ((case_hash * 13 + 5) % 200 - 100) / 10000.0
    victim_lat = city_center[0] + victim_offset_x
    victim_lng = city_center[1] + victim_offset_y
    suspect_offset_x = ((case_hash * 17 + 11) % 240 - 120) / 10000.0
    suspect_offset_y = ((case_hash * 23 + 7) % 240 - 120) / 10000.0
    suspect_lat = victim_lat + suspect_offset_x
    suspect_lng = victim_lng + suspect_offset_y
    amount = case.amount if case and case.amount else record_total
    num_mules = case.linked_accounts if case and case.linked_accounts else record_accounts
    hour = max(6, min(23, int(sum(record.occurred_at.hour for record in synthetic_records) / len(synthetic_records))))

    def _expected_window(h):
        if 17 <= h < 18:
            return "17:00-19:00"
        elif 18 <= h < 19:
            return "18:00-20:00"
        elif 19 <= h < 20:
            return "18:30-20:30"
        elif 20 <= h < 21:
            return "19:00-21:00"
        elif h >= 21:
            return "20:00-22:00"
        return "18:00-20:00"

    reasons_map = {
        "high": [
            "Evening withdrawal pattern matches historical behavior",
            "Transaction velocity spike detected in linked accounts",
            "Geographic cluster aligns with previous activity",
        ],
        "medium": [
            "Historical cash-out similarity in this area",
            "Account network shows coordinated movement",
            "Moderate proximity to victim location",
        ],
        "low": [
            "Low crime density in area",
            "Distance from primary suspect route",
            "Minimal historical activity",
        ],
    }

    ranked = []
    for i, atm in enumerate(city_atms):
        dist_victim = haversine(victim_lat, victim_lng, atm.latitude, atm.longitude)
        dist_suspect = haversine(suspect_lat, suspect_lng, atm.latitude, atm.longitude)
        atm_hash = stable_int(atm.atm_id) % 10000

        atm_type_map = {"high_value": 1.0, "commercial": 0.8, "bank": 0.7, "highway": 0.6, "retail": 0.4}
        atm_type_val = getattr(atm, 'atm_type', None) or getattr(atm, 'type', None)
        atm_type_score = atm_type_map.get(atm_type_val, 0.4 + (atm_hash % 5) * 0.15) if atm_type_val else 0.4 + (atm_hash % 5) * 0.15

        features = {
            "distance_from_victim_km": round(dist_victim, 2),
            "historical_crime_density": atm.historical_crime if hasattr(atm, 'historical_crime') and atm.historical_crime else 1 + (atm_hash % 14),
            "time_window_match": 1.0 if 17 <= hour <= 22 else 0.0,
            "atm_type_score": atm_type_score,
            "suspect_distance_km": round(dist_suspect, 2),
            "recent_withdrawal_freq": round(min(num_mules / 8, 0.9), 3),
            "amount": round(amount, 2),
            "num_mule_accounts": num_mules,
            "hour": hour,
            "day_of_week": (case_hash + 1) % 7,
            "transaction_velocity": round(min(num_mules / 6, 1.0), 3),
            "proximity_score": round(max(0, 1 - dist_victim / 8), 3),
            "density_score": round(min((atm.historical_crime if hasattr(atm, 'historical_crime') and atm.historical_crime else 1 + (atm_hash % 14)) / 15, 1.0), 3),
            "suspect_proximity": round(max(0, 1 - dist_suspect / 10), 3),
            "amount_factor": round(min(amount / 150000, 1.0), 3),
        }

        ml_result = _predict_or_503(features, case_id=case_id)
        score = ml_result["risk_score"]
        confidence = ml_result["confidence"]

        if score > 70:
            level = "high"
            status = "High"
        elif score > 45:
            level = "medium"
            status = "Medium"
        else:
            level = "low"
            status = "Watch"

        ranked.append({
            "rank": i + 1,
            "atm_id": atm.atm_id,
            "location_name": atm.name,
            "risk_score": score,
            "prediction_features": dict(features),
            "model_output": ml_result,
            "model_info": _location_model_info(ml_result),
            "expected_window": _expected_window(hour),
            "distance": f"{round(dist_victim, 1)} km",
            "reason": reasons_map[level][atm_hash % len(reasons_map[level])],
            "status": status,
            "latitude": atm.latitude,
            "longitude": atm.longitude,
            "confidence": confidence,
        })

    ranked.sort(key=lambda x: x["risk_score"], reverse=True)
    for i, r in enumerate(ranked):
        r["rank"] = i + 1

    primary = ranked[0]

    # Evidence values are derived from persisted synthetic records.
    _ev_hours = max(2, min(9, len(synthetic_records) // 2))
    _ev_pct = 60 + (record_accounts % 5) * 5
    _ev_geo_radius = 2 + (case_hash % 5)
    _ev_geo_count = min(len(synthetic_records), 3 + (record_accounts % 5))
    _ev_geo_total = len(synthetic_records)
    _ev_geo_km = 2 + (case_hash % 4)
    _ev_net_hours = max(3, min(8, len(synthetic_records) // 2))
    _ev_sim_pct = 60 + (record_total % 25)
    _ev_sim_count = record_accounts

    evidence = {
        "transaction_pattern": {
            "category": "Transaction Pattern",
            "description": "Rapid fund movement through linked accounts detected",
            "strength": "Strong" if amount > 50000 else "Moderate",
            "details": f"Rs.{amount:,.0f} moved across {num_mules} accounts within {_ev_hours} hours before complaint filing."
        },
        "temporal_pattern": {
            "category": "Temporal Pattern",
            "description": "Historical withdrawals concentrated during evening hours",
            "strength": "Strong" if 17 <= hour <= 21 else "Moderate",
            "details": f"{_ev_pct}% of simulated withdrawals occurred between 17:00-21:00."
        },
        "geographic_signal": {
            "category": "Geographic Signal",
            "description": f"Geographic clustering within {_ev_geo_radius}km radius of primary location",
            "strength": "Strong",
            "details": f"{_ev_geo_count} of {_ev_geo_total} simulated withdrawals within {_ev_geo_km}km of {primary['atm_id']}."
        },
        "account_network": {
            "category": "Account Network",
            "description": "Multiple linked accounts show coordinated activity",
            "strength": "Strong" if num_mules >= 4 else "Moderate",
            "details": f"{num_mules} linked accounts received transfers from common source within {_ev_net_hours} hours."
        },
        "historical_similarity": {
            "category": "Historical Similarity",
            "description": f"Pattern matches {_ev_sim_pct}% in an illustrative synthetic similarity score (no verified cases)",
            "strength": "Strong",
            "details": f"Similar fraud typology observed in {_ev_sim_count} illustrative synthetic cases (not observed historical cases)."
        }
    }

    result = {
        "case_id": case_id,
        "status": "HIGH PRIORITY" if primary["risk_score"] > 70 else "MEDIUM PRIORITY",
        "primary_location": primary,
        "ranked_locations": ranked,
        "risk_trend": [10, 18, 27, 44, 67, primary["risk_score"]],
        "evidence": _label_simulated_evidence(evidence),
        "model_info": {
            "model_version": primary["model_info"]["model_version"],
            "accuracy": model_accuracy,
            "model_type": "Weighted ensemble of available estimators",
            "models": list(primary["model_output"].get("ensemble", {})),
            "validation_scope": "Synthetic binary-classification benchmark; not location-ranking accuracy",
            "features_used": 15,
            "ensemble_weights": primary["model_output"].get("model_weights", {}),
            "precision": model_meta.get("precision") if model_meta else None,
            "recall": model_meta.get("recall") if model_meta else None,
            "f1_score": model_meta.get("f1_score") if model_meta else None,
            "pr_auc": model_meta.get("pr_auc") if model_meta else None,
        },
        "disclaimer": "Risk scores are model-derived estimates on synthetic data. They indicate relative likelihood, not certainty. Officer judgment is required for all enforcement decisions.",
    }

    _persist_prediction(db, result)
    _raise_high_risk_alert(db, case_id, result.get("primary_location") or {})

    return result


# ─── Helper Functions ─────────────────────────────────────────────────────────

def add_audit(db: Session, action: str, details: str, action_type: str = "action", case_id: str = None):
    audit = AuditLog(
        action=action,
        details=details,
        action_type=action_type,
        case_id=case_id,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    db.commit()


def _raise_high_risk_alert(db: Session, case_id: str, primary: dict):
    """Toast + SMS every time a HIGH (>70) prediction is produced.

    Alert *rows* are deduplicated (one open alert per case+ATM) so the
    registry never floods; the SMS job and WebSocket broadcast fire on
    every production. No audit entry — automatic predictions must not
    spam the audit trail (only officer actions are logged there).
    """
    if not primary or primary.get("risk_score", 0) <= 70:
        return None
    alert_msg = (
        f"HIGH-RISK prediction: {case_id} may cash out at {primary.get('atm_id')} "
        f"({primary.get('location_name')}) — Risk Score {primary.get('risk_score')}% "
        f"in window {primary.get('expected_window')}"
    )
    # Alert.location is EncryptedText: SQL LIKE would match ciphertext, so
    # dedupe after decryption like the rest of the codebase (see get_audit_log).
    prefix = f"{primary.get('atm_id')}"
    candidates = (
        db.query(Alert)
        .filter(Alert.case_id == case_id, Alert.acknowledged == False)
        .all()
    )
    alert = next((a for a in candidates if (a.location or "").startswith(prefix)), None)
    if alert is None:
        alert = Alert(
            alert_id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
            case_id=case_id,
            message=alert_msg,
            risk_level="High",
            location=f"{primary.get('atm_id')}, {primary.get('location_name')}",
            time_window=primary.get("expected_window", ""),
            timestamp=datetime.now(timezone.utc).strftime("%H:%M:%S"),
            acknowledged=False,
        )
        db.add(alert)
        db.commit()
    # SMS goes to INVESTIGATOR_PHONE_NUMBER by default (see sms_client).
    enqueue_notification(db, "sms", {"message": alert_msg})
    # Broadcast for the on-screen toast + sound. Mirrors the transaction path;
    # `manager` is defined below — resolved at call time.
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(manager.broadcast({
                "type": "alert",
                "alert_id": alert.alert_id,
                "case_id": case_id,
                "message": alert_msg,
                "risk_level": "High",
                "risk_score": primary.get("risk_score"),
                "atm_id": primary.get("atm_id"),
                "location": primary.get("location_name"),
                "time_window": primary.get("expected_window"),
                "timestamp": alert.timestamp,
            }))
    except RuntimeError:
        pass
    return alert


# ─── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/health/live")
def liveness_check():
    """Public liveness probe — status only, no operational details."""
    return {"status": "ok"}


@app.get("/api/health")
def health_check(user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    model_meta = get_metadata()
    try:
        pred_count = db.query(Prediction).count()
        ranked_count = db.query(RankedLocation).count()
        case_count = db.query(Case).count()
        db_healthy = True
    except Exception as e:
        logger.error(f"[HealthCheck] DB query failed: {e}")
        pred_count = ranked_count = case_count = -1
        db_healthy = False

    return {
        "status": "healthy" if db_healthy and model_meta is not None else "degraded",
        "mode": "postgresql" if not USE_SQLITE else "sqlite",
        "version": "5.0.0",
        "model_loaded": model_meta is not None,
        "model_accuracy": model_meta.get("accuracy") if model_meta else None,
        "model_recall": model_meta.get("recall") if model_meta else None,
        "model_f1": model_meta.get("f1_score") if model_meta else None,
        "model_precision": model_meta.get("precision") if model_meta else None,
        "model_pr_auc": model_meta.get("pr_auc") if model_meta else None,
        "db_healthy": db_healthy,
        "predictions_stored": pred_count,
        "ranked_locations_stored": ranked_count,
        "total_cases": case_count,
    }


@app.get("/api/health/db-check")
def db_health_check(user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    """Verify that predictions and ranked_locations are actually growing."""
    from sqlalchemy import func
    try:
        pred_count = db.query(Prediction).count()
        ranked_count = db.query(RankedLocation).count()
        recent_pred = db.query(Prediction).order_by(Prediction.id.desc()).first()
        return {
            "status": "ok",
            "predictions_count": pred_count,
            "ranked_locations_count": ranked_count,
            "latest_prediction_id": recent_pred.id if recent_pred else None,
            "latest_prediction_case": recent_pred.case_id if recent_pred else None,
            "verdict": "Data is being persisted correctly" if pred_count > 0 and ranked_count > 0 else "No predictions stored yet",
        }
    except Exception as e:
        logger.error(f"[DBCheck] Failed: {e}")
        return {"status": "error", "detail": str(e)}


# ─── City Endpoints ──────────────────────────────────────────────────────────

@app.get("/api/cities")
def list_cities(user: dict = Depends(require_permission("read"))):
    return get_all_cities()


@app.get("/api/cities/{city_id}")
def get_city_info(city_id: str, user: dict = Depends(require_permission("read"))):
    city = get_city(city_id)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    return {
        "id": city_id,
        "name": city["name"],
        "state": city["state"],
        "center": city["center"],
        "zoom": city["zoom"],
        "atm_count": len(city["atms"]),
        "stats": city["crime_stats"],
    }


@app.get("/api/cities/{city_id}/atms")
def get_city_atm_list(city_id: str, user: dict = Depends(require_permission("read"))):
    atms = get_city_atms(city_id)
    if not atms:
        raise HTTPException(status_code=404, detail="City not found")
    return atms


@app.get("/api/cities/{city_id}/predictions")
def get_city_predictions(city_id: str, user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    synthetic_case_id = f"SYN-CITY-{city_id.upper()}"
    existing_case = db.query(Case).filter(Case.case_id == synthetic_case_id).first()
    if existing_case:
        require_case(db, user, synthetic_case_id)
    now = time.time()
    cached = _city_prediction_cache.get(city_id)
    fingerprint = _current_model_fingerprint()
    if (existing_case and cached and (now - cached[0]) < _CITY_CACHE_TTL
            and cached[1].get("model_info", {}).get("model_fingerprint") == fingerprint):
        # A case prediction may have replaced these rows since the city cache
        # was populated. Restore the exact snapshot returned by this response.
        _persist_prediction(db, cached[1])
        return cached[1]

    city = get_city(city_id)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    atms = city["atms"]
    city_hash = stable_int(city_id)
    synthetic_case_id = f"SYN-CITY-{city_id.upper()}"
    if not db.query(Case).filter(Case.case_id == synthetic_case_id).first():
        db.add(Case(
            case_id=synthetic_case_id,
            crime_type="Synthetic simulation",
            amount=0,
            linked_accounts=0,
            current_risk="Medium",
            status="active",
            victim_name="SYNTHETIC-VICTIM",
            contact="SYNTHETIC-ONLY",
            description=f"Persisted synthetic city fixture for {city_id}",
        ))
        db.commit()
    synthetic_records = ensure_synthetic_transactions(db, synthetic_case_id, city_id, atms)
    prediction_time = datetime.now()

    ranked = []
    for i, atm in enumerate(atms):
        atm_h = stable_int(city_id + atm["id"]) % 10000
        _dist = round(0.5 + (atm_h % 751) / 100.0, 2)
        _crime = 1 + (atm_h % 15)
        _sus_dist = round(1.0 + (atm_h % 1101) / 100.0, 2)
        _r_freq = round(min((2 + (atm_h % 7)) / 8, 0.9), 3)
        _amt = round(15000 + (atm_h % 105001), 2)
        _mules = 2 + (atm_h % 5)
        _t_vel = round(min(_mules / 6, 1.0), 3)
        _sus_prox = round(max(0, 1 - _sus_dist / 10), 3)
        _amt_factor = round(min(_amt / 150000, 1.0), 3)

        features = {
            "distance_from_victim_km": _dist,
            "historical_crime_density": _crime,
            "time_window_match": 1.0 if 17 <= prediction_time.hour <= 22 else 0.0,
            "atm_type_score": {"high_value": 1.0, "commercial": 0.8, "bank": 0.7, "highway": 0.6, "retail": 0.4}.get(atm["type"], 0.5),
            "suspect_distance_km": _sus_dist,
            "recent_withdrawal_freq": _r_freq,
            "amount": _amt,
            "num_mule_accounts": _mules,
            "hour": prediction_time.hour,
            "day_of_week": prediction_time.weekday(),
            "transaction_velocity": _t_vel,
            "proximity_score": round(atm["risk"], 3),
            "density_score": round(_crime / 15, 3),
            "suspect_proximity": _sus_prox,
            "amount_factor": _amt_factor,
        }

        ml_result = _predict_or_503(features, case_id=synthetic_case_id)
        score = ml_result["risk_score"]

        _win_hour = prediction_time.hour
        if _win_hour < 18:
            _win = "17:00-19:00"
        elif _win_hour < 20:
            _win = "18:00-20:00"
        else:
            _win = "19:00-21:00"

        ranked.append({
            "rank": i + 1,
            "atm_id": atm["id"],
            "location_name": atm["name"],
            "risk_score": score,
            "prediction_features": dict(features),
            "model_output": ml_result,
            "model_info": _location_model_info(ml_result),
            "expected_window": _win,
            "distance": f"{_dist} km",
            "reason": "Historical pattern match" if score > 60 else "Low activity area",
            "status": "High" if score > 70 else ("Medium" if score > 45 else "Watch"),
            "latitude": atm["lat"],
            "longitude": atm["lng"],
            "confidence": ml_result["confidence"],
        })

    ranked.sort(key=lambda x: x["risk_score"], reverse=True)
    for i, r in enumerate(ranked):
        r["rank"] = i + 1

    primary = ranked[0] if ranked else None
    num_mules = len({record.to_account for record in synthetic_records})

    _ev_hours = max(2, min(9, len(synthetic_records) // 2))
    _ev_amt = sum(record.amount for record in synthetic_records)
    _ev_pct = 60 + (len(synthetic_records) % 26)
    _ev_geo_radius = 2 + (city_hash % 5)
    _ev_geo_count = min(len(synthetic_records), 3 + (city_hash % 5))
    _ev_geo_total = len(synthetic_records)
    _ev_geo_km = 2 + (city_hash % 4)
    _ev_net_hours = 3 + (city_hash % 6)
    _ev_sim_pct = 60 + (city_hash % 25)
    _ev_sim_count = 3 + (city_hash % 18)

    evidence = {}
    if primary:
        evidence = {
            "transaction_pattern": {
                "category": "Transaction Pattern",
                "description": f"Coordinated mule transfers detected across {num_mules} accounts within {_ev_hours} hours",
                "strength": "Strong" if num_mules >= 4 else "Moderate",
                "details": f"Rs.{_ev_amt:,} moved through {num_mules} linked accounts before cash-out."
            },
            "temporal_pattern": {
                "category": "Temporal Pattern",
                "description": f"Matches peak cash-out window ({primary.get('expected_window', '18:00-20:00')})",
                "strength": "Strong",
                "details": f"{_ev_pct}% of simulated withdrawals occurred between 17:00-21:00."
            },
            "geographic_signal": {
                "category": "Geographic Signal",
                "description": f"Geographic clustering within {_ev_geo_radius}km radius of primary location",
                "strength": "Strong",
                "details": f"{_ev_geo_count} of {_ev_geo_total} simulated withdrawals within {_ev_geo_km}km of {primary['atm_id']}."
            },
            "account_network": {
                "category": "Account Network",
                "description": "Multiple linked accounts show coordinated activity",
                "strength": "Strong" if num_mules >= 4 else "Moderate",
                "details": f"{num_mules} linked accounts received transfers from common source within {_ev_net_hours} hours."
            },
            "historical_similarity": {
                "category": "Historical Similarity",
                "description": f"Pattern matches {_ev_sim_pct}% in an illustrative synthetic similarity score (no verified cases)",
                "strength": "Strong",
                "details": f"Similar fraud typology observed in {_ev_sim_count} illustrative synthetic cases (not observed historical cases)."
            }
        }

    res_payload = {
        "city": city["name"],
        "state": city["state"],
        "center": city["center"],
        "ranked_locations": ranked,
        "total_atms": len(atms),
        "model_accuracy": get_metadata().get("accuracy") if get_metadata() else None,
        "case_id": synthetic_case_id,
        "model_info": primary["model_info"] if primary else {},
        "status": "HIGH PRIORITY" if primary and primary["risk_score"] > 70 else "MEDIUM PRIORITY",
        "primary_location": primary,
        "risk_trend": [10, 18, 27, 44, 67, primary["risk_score"]] if primary else [],
        "evidence": _label_simulated_evidence(evidence),
        "disclaimer": "Synthetic operational simulation only. Risk scores are not real-world validation and require officer review.",
        "data_source": "synthetic-fixture transaction_records",
    }
    _persist_prediction(db, res_payload)
    _raise_high_risk_alert(db, synthetic_case_id, primary or {})
    _city_prediction_cache[city_id] = (time.time(), res_payload)
    return res_payload


@app.get("/api/dashboard")
def get_dashboard(user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    from sqlalchemy import func
    cases = visible_cases(db, user)
    active = cases.filter(Case.status == "active").count()
    unacknowledged = db.query(Alert).join(Case).filter(visibility_filter(user), Alert.acknowledged == False).count()
    resolved_amount = db.query(func.coalesce(func.sum(Case.amount), 0)).filter(visibility_filter(user), Case.status == "resolved").scalar()
    high_risk_locs = db.query(RankedLocation).join(Prediction).join(Case).filter(visibility_filter(user), RankedLocation.risk_score >= 70).count()
    return {
        "active_cases": active, "high_risk_locations": high_risk_locs,
        "alerts_today": unacknowledged, "avg_lead_time": "Not measured",
        "prevented_fraud": None, "resolved_case_amount": int(resolved_amount or 0),
        "mules_flagged": None,
        "metrics_note": "Resolved amounts are not verified prevented fraud; mule counts and lead time are not measured",
    }



@app.get("/api/cases")
def get_cases(user: dict = Depends(verify_token), limit: int = Query(default=200, ge=1, le=500), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    q = visible_cases(db, user).order_by(Case.case_id)
    cases = q.offset(offset).limit(limit).all()

    def _dec(val):
        return val or ""

    # PII visible only to admin and inspector roles; bank_officer/analyst see redacted fields
    can_see_pii = user.get("role") in ("admin", "inspector")

    return [
        {
            "case_id": c.case_id,
            "crime_type": c.crime_type,
            "amount": c.amount,
            "linked_accounts": c.linked_accounts,
            "current_risk": c.current_risk,
            "last_updated": c.last_updated,
            "status": c.status,
            "assigned_to": c.assigned_to,
            "department": c.department or "",
            "victim_name": _dec(c.victim_name) if can_see_pii else "[REDACTED]",
            "contact": _dec(c.contact) if can_see_pii else "[REDACTED]",
            "description": _dec(c.description) if can_see_pii else "[REDACTED]",
        }
        for c in cases
    ]


@app.post("/api/cases/{case_id}/resolve")
def resolve_case(case_id: str, user: dict = Depends(require_permission("override")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    case = require_case(db, user, case_id, 'close')

    case.status = "resolved"
    case.current_risk = "Resolved"
    case.last_updated = "Just now"
    db.commit()
    _invalidate_prediction_caches()

    add_audit(db, "Case Resolved", f"Case {case_id} marked as resolved by {user.get('name', user.get('id', 'unknown'))} ({user.get('role', '?')})", "case", case_id)

    return {"status": "resolved", "case_id": case_id}


@app.get("/api/predictions")
def get_all_predictions(user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    now = time.time()
    cache_key = (user.get("id"), user.get("role"), user.get("department"))
    cached = _predictions_cache.get(cache_key)
    if cached and (now - cached[0]) < _PREDICTIONS_CACHE_TTL:
        return cached[1]
    cases = visible_cases(db, user).filter(Case.status == "active").limit(5).all()
    result = [get_predictions_for_case(c.case_id, db) for c in cases]
    _predictions_cache[cache_key] = (now, result)
    return result


@app.get("/api/predictions/{case_id}")
@limiter.limit("30/minute")
def get_prediction(request: Request, case_id: str, user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    require_case(db, user, case_id)
    return get_predictions_for_case(case_id, db)


@app.post("/api/transactions")
def simulate_transaction(request: Request, tx: TransactionCreate, user: dict = Depends(require_permission("write")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    case = require_case(db, user, tx.case_id, 'write')
    idem_key = idempotency_key_from(request)
    if idem_key:
        idem_key = hashlib.sha256((user["id"] + "|" + tx.case_id + "|" + idem_key).encode()).hexdigest()
    if idem_key:
        replay = check_replay(db, idem_key, "POST", "/api/transactions")
        if replay is not None:
            return replay
    if db.query(AtmLocation.atm_id).first() is None:
        raise HTTPException(status_code=503, detail="Prediction service unavailable: no ATM reference data")
    _current_model_fingerprint()  # do not record a transaction when models cannot load
    add_audit(
        db,
        action="Transaction Simulated",
        details=f"₹{tx.amount:,.0f} transferred from {tx.from_account} to {tx.to_account}" + (f" via {tx.atm_id}" if tx.atm_id else ""),
        action_type="prediction",
        case_id=tx.case_id
    )
    db.add(TransactionRecord(
        case_id=tx.case_id,
        from_account=tx.from_account,
        to_account=tx.to_account,
        amount=tx.amount,
        atm_id=tx.atm_id,
        location=tx.location,
        occurred_at=datetime.now(timezone.utc),
        source="synthetic-simulation",
    ))

    # The simulated transfer is preserved as a TransactionRecord row above;
    # case.amount stays the reported complaint amount and is never inflated
    # by simulations (repeated simulations previously corrupted it).
    case.linked_accounts = max(case.linked_accounts, 2)
    case.current_risk = "High"
    case.last_updated = "Just now"
    db.commit()
    _invalidate_prediction_caches()

    updated_prediction = get_predictions_for_case(tx.case_id, db)

    # Defensive validation of the prediction response; missing ATM reference
    # data is rejected above before any audit or transaction mutation.
    primary = (updated_prediction or {}).get("primary_location") if isinstance(updated_prediction, dict) else None
    if not isinstance(primary, dict) or "risk_score" not in primary:
        raise HTTPException(
            status_code=503,
            detail="Prediction service not initialized (no ATM reference data). Transaction recorded but no alert generated.",
        )
    if primary["risk_score"] > 70:
        alert_msg = f"HIGH-RISK: New transaction of ₹{tx.amount:,.0f} detected. Top predicted cash-out at {primary['atm_id']} ({primary['location_name']}) — Risk Score {primary['risk_score']}%"
        alert = Alert(
            alert_id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
            case_id=tx.case_id,
            message=alert_msg,
            risk_level="High",
            location=f"{primary['atm_id']}, {primary['location_name']}",
            time_window=primary["expected_window"],
            timestamp=datetime.now(timezone.utc).strftime("%H:%M:%S"),
            acknowledged=False
        )
        db.add(alert)
        db.commit()

        # Durable dispatch: enqueue SMS/email as tracked jobs (retry + dead-letter)
        # instead of untracked fire-and-forget threads.
        enqueue_notification(db, "sms", {"message": alert_msg})
        enqueue_notification(
            db, "email",
            {"subject": f"High-Risk Cash-Out Alert ({tx.case_id})", "message": alert_msg},
        )
        # Test fixtures process queued jobs explicitly with fake senders; never
        # dispatch real SMS/email or race fixture teardown in TESTING mode.
        if os.getenv("TESTING") != "1":
            threading.Thread(
                target=run_notification_worker,
                args=(SessionLocal, send_sms_alert, send_email_alert),
                daemon=True,
            ).start()

        # Broadcast alert via WebSocket to all connected clients
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(manager.broadcast({
                    "type": "alert",
                    "alert_id": alert.alert_id,
                    "case_id": tx.case_id,
                    "message": alert_msg,
                    "risk_level": "High",
                    "risk_score": primary["risk_score"],
                    "atm_id": primary["atm_id"],
                    "location": primary["location_name"],
                    "time_window": primary["expected_window"],
                    "timestamp": alert.timestamp,
                }))
        except RuntimeError:
            pass

    return _finalize_transaction_response(db, idem_key, {
        "status": "transaction_recorded",
        "transaction": {
            "case_id": tx.case_id,
            "amount": tx.amount,
            "from_account": tx.from_account,
            "to_account": tx.to_account,
        },
        "updated_prediction": updated_prediction,
    })


def _finalize_transaction_response(db, idem_key, body: dict):
    if idem_key:
        store_replay(db, idem_key, "POST", "/api/transactions", 200, body)
    return body


@app.post("/api/alerts")
def create_alert(request: Request, alert_data: AlertCreate, user: dict = Depends(require_permission("write")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    case = require_case(db, user, alert_data.case_id, 'write')
    idem_key = idempotency_key_from(request)
    if idem_key:
        idem_key = hashlib.sha256((user["id"] + "|" + alert_data.case_id + "|" + idem_key).encode()).hexdigest()
    if idem_key:
        replay = check_replay(db, idem_key, "POST", "/api/alerts")
        if replay is not None:
            return replay
    alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
    alert = Alert(
        alert_id=alert_id,
        case_id=alert_data.case_id,
        message=alert_data.message,
        risk_level=alert_data.risk_level,
        location=alert_data.location,
        time_window=alert_data.time_window,
        timestamp=datetime.now(timezone.utc).strftime("%H:%M:%S"),
        acknowledged=False
    )
    db.add(alert)
    db.commit()

    add_audit(
        db,
        action="Alert Created",
        details=f"Alert {alert_id} created for {alert_data.case_id} — {alert_data.risk_level} risk at {alert_data.location}",
        action_type="alert",
        case_id=alert_data.case_id
    )

    return _finalize_alert_response(db, idem_key, {
        "status": "created",
        "alert_id": alert_id,
        "alert": {
            "alert_id": alert_id,
            "case_id": alert_data.case_id,
            "message": alert_data.message,
            "risk_level": alert_data.risk_level,
            "location": alert_data.location,
            "time_window": alert_data.time_window,
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "acknowledged": False,
            "acknowledged_at": None,
        }
    })


def _finalize_alert_response(db, idem_key, body: dict):
    if idem_key:
        store_replay(db, idem_key, "POST", "/api/alerts", 200, body)
    return body


@app.get("/api/alerts")
def get_alerts(user: dict = Depends(require_permission("read")), limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    q = db.query(Alert).join(Case).filter(visibility_filter(user))
    alerts = q.order_by(Alert.timestamp.desc()).offset(offset).limit(limit).all()
    return [
        {
            "alert_id": a.alert_id,
            "case_id": a.case_id,
            "message": a.message,
            "risk_level": a.risk_level,
            "location": a.location,
            "time_window": a.time_window,
            "timestamp": a.timestamp,
            "acknowledged": a.acknowledged,
            "acknowledged_at": a.acknowledged_at,
        }
        for a in alerts
    ]


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str, user: dict = Depends(require_permission("read")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    require_case(db, user, alert.case_id, "acknowledge")
    alert.acknowledged = True
    alert.acknowledged_at = datetime.now().strftime("%H:%M:%S")
    db.commit()

    add_audit(db, "Alert Acknowledged", "Alert {} acknowledged by {}".format(alert_id, user["id"]), "alert", alert.case_id)

    return {"status": "acknowledged", "alert_id": alert_id}


@app.get("/api/locations")
def get_locations(user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    locations = db.query(AtmLocation).all()
    return [
        {"atm_id": l.atm_id, "name": l.name, "lat": l.latitude, "lng": l.longitude, "area": l.area}
        for l in locations
    ]


@app.get("/api/audit")
def get_audit_log(
    user: dict = Depends(require_role("admin", "inspector", "analyst")),
    db: Session = Depends(get_db),
    q: Optional[str] = Query(default=None, max_length=200),
    action_type: Optional[str] = Query(default=None, max_length=50),
    actor: Optional[str] = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=500),
):
    """Auditor feed with server-side search/filter (text, action type, actor)."""
    qry = db.query(AuditLog)
    if user.get("role") != "admin":
        qry = qry.join(Case).filter(visibility_filter(user))
    if action_type:
        qry = qry.filter(AuditLog.action_type == action_type)
    # Encrypted text is searched after decryption, never with ciphertext LIKE.
    logs = []
    for log in qry.order_by(AuditLog.timestamp.desc()).yield_per(100):
        if q and q.casefold() not in (log.action + " " + log.details).casefold():
            continue
        if actor and actor.casefold() not in log.details.casefold():
            continue
        logs.append(log)
        if len(logs) >= limit:
            break
    return [
        {
            "time": l.timestamp.strftime("%H:%M:%S") if l.timestamp else "",
            "date": l.timestamp.strftime("%Y-%m-%d") if l.timestamp else "",
            "action": l.action,
            "details": l.details,
            "action_type": l.action_type,
            "case_id": l.case_id or "",
        }
        for l in logs
    ]


@app.get("/api/suspects/{case_id}")
def get_suspects(case_id: str, user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    case = require_case(db, user, case_id, 'read')

    suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()

    if not suspects:
        c_hash = stable_int(case_id) % 10000
        atm_locations = db.query(AtmLocation).all()
        num_suspects = 1 + (c_hash % 3)

        for i in range(num_suspects):
            s_hash = (c_hash + i * 7) % 10000
            risk_levels = ["High", "Medium", "Low"]
            suspect = Suspect(
                id=f"SUS-{case_id.split('-')[-1]}-{i+1:03d}",
                case_id=case_id,
                name=f"Unknown Suspect {i+1}",
                risk_level=risk_levels[s_hash % 3],
                last_seen=atm_locations[s_hash % len(atm_locations)].name if atm_locations else "Unknown",
                accounts_linked=1 + (s_hash % 4),
                status="active" if i == 0 else "monitoring",
            )
            db.add(suspect)
        db.commit()

        suspects = db.query(Suspect).filter(Suspect.case_id == case_id).all()

    return {
        "case_id": case_id,
        "suspects": [
            {
                "id": s.id,
                "name": s.name,
                "risk_level": s.risk_level,
                "last_seen": s.last_seen,
                "accounts_linked": s.accounts_linked,
                "status": s.status,
            }
            for s in suspects
        ]
    }


# ─── WebSocket + New Endpoints ─────────────────────────────────────────────────

def _current_ws_user(db, ticket_user):
    from models_db import User
    user = db.query(User).filter(User.id == ticket_user.get("id"), User.is_active == True, User.is_approved == True).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Inactive WebSocket session")
    return {"id": user.id, "role": user.role, "department": user.department}


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
        self.users: dict = {}

    async def connect(self, ws: WebSocket, user: dict):
        await ws.accept()
        self.active.append(ws)
        self.users[ws] = user

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        self.users.pop(ws, None)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                if data.get("case_id"):
                    with SessionLocal() as db:
                        require_case(db, _current_ws_user(db, self.users.get(ws, {})), data["case_id"])
                await ws.send_json(data)
            except HTTPException:
                continue
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()


class EvidenceAnchor(BaseModel):
    case_id: str
    evidence_type: str
    content: str
    officer_id: str = ""  # compatibility only; authenticated identity is authoritative


class AnomalyRequest(BaseModel):
    amount: float
    num_mule_accounts: int
    hour_of_day: int
    transaction_velocity: float


@app.websocket("/ws/alerts")
async def websocket_alerts(ws: WebSocket, ticket: str = Query(default=None)):
    # Authenticate via short-lived ticket (not JWT in URL)
    if not ticket:
        await ws.close(code=4001, reason="Ticket required — GET /api/auth/ws-ticket")
        return

    user = consume_ws_ticket(ticket)
    if not user:
        await ws.close(code=4002, reason="Invalid or expired ticket — request a new one via /api/auth/ws-ticket")
        return

    session_id = user.get("id", "unknown")

    # Per-session rate limit: max 3 concurrent connections per user
    if not ws_tracker.can_connect(session_id):
        await ws.close(code=4004, reason="Too many connections for this session (max 3)")
        return

    ws_tracker.connect(session_id)
    await manager.connect(ws, user)
    try:
        await ws.send_json({
            "type": "connected",
            "user": user["name"],
            "role": user["role"],
            "message": f"Authenticated as {user['name']} ({user['role']})",
        })

        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_json({"type": "pong"})
            elif data.startswith("subscribe:"):
                case_id = data.split(":", 1)[1]
                try:
                    with SessionLocal() as db:
                        require_case(db, _current_ws_user(db, user), case_id)
                    await ws.send_json({"type": "subscribed", "case_id": case_id})
                except HTTPException:
                    await ws.send_json({"type": "error", "message": "Case not found"})
    except WebSocketDisconnect:
        pass
    finally:
        ws_tracker.disconnect(session_id)
        manager.disconnect(ws)


@app.get("/api/model/card")
def model_card(user: dict = Depends(require_permission("read"))):
    meta = get_metadata()
    if not meta:
        raise HTTPException(status_code=404, detail="No model trained yet")
    return {
        "model_type": meta.get("model_type"),
        "model_version": meta.get("model_version", "unversioned"),
        "accuracy": meta.get("accuracy"),
        "precision": meta.get("precision"),
        "recall": meta.get("recall"),
        "f1_score": meta.get("f1_score"),
        "pr_auc": meta.get("pr_auc"),
        "roc_auc": meta.get("roc_auc"),
        "rf_accuracy": meta.get("rf_accuracy"),
        "xgb_accuracy": meta.get("xgb_accuracy"),
        "cv_accuracy": meta.get("cv_accuracy"),
        "cv_std": meta.get("cv_std"),
        "n_samples": meta.get("n_samples"),
        "n_features": meta.get("n_features"),
        "ensemble_method": meta.get("ensemble_method"),
        "training_date": meta.get("training_date"),
        "feature_columns": meta.get("feature_columns"),
        "positive_ratio": meta.get("positive_ratio"),
        "confusion_matrix": meta.get("confusion_matrix"),
        "evaluation_status": meta.get("evaluation_status"),
        "split_provenance": meta.get("split_provenance"),
        "target_semantics": meta.get("target_semantics"),
        "data_limitations": meta.get("data_limitations"),
        "future_outcome_metrics": meta.get("future_outcome_metrics"),
        "n_drifted_features": meta.get("n_drifted_features"),
        "dataset": meta.get("dataset"),
        "cities": meta.get("cities"),
        "atms": meta.get("atms"),
        **_validation_protocol_block(meta),
    }


def _validation_protocol_block(meta: dict) -> dict:
    """Honest synthetic-benchmark protocol: baseline, calibration, thresholds."""
    cm = meta.get("confusion_matrix") or {}
    tp = cm.get("tp", 0); fp = cm.get("fp", 0)
    fn = cm.get("fn", 0); tn = cm.get("tn", 0)
    total = tp + fp + fn + tn
    # Majority-class baseline: accuracy of always predicting the majority class.
    provenance = meta.get("split_provenance")
    baseline = f"{max(tn + fp, tp + fn) / total * 100:.2f}%" if total and provenance else None
    # Frozen-ensemble holdout revalidation (revalidate_model.py), if present.
    holdouts = None
    try:
        with open(os.path.join(ml_engine.MODEL_DIR, "validation_report.json"), encoding="utf-8") as _vf:
            _vr = json.load(_vf)
        holdouts = {
            "protocol": _vr.get("protocol"),
            "status": _vr.get("status"),
            "slices": _vr.get("slices"),
            "calibration": _vr.get("calibration"),
            "threshold_sweep": _vr.get("threshold_sweep"),
            "baseline_comparison": _vr.get("baseline_comparison"),
            "previous_prefix_diagnostic": _vr.get("previous_prefix_diagnostic"),
            "future_outcome_metrics": _vr.get("future_outcome_metrics"),
        }
    except (OSError, ValueError):
        holdouts = None
    return {
        "validation_protocol": {
            "data": "synthetic benchmark (see dataset/version in metadata)",
            "split": (
                "pre-fit group-disjoint train/group/location/time synthetic exclusions; see saved split provenance"
                if provenance else
                "unavailable: frozen artifacts lack verified pre-fit split provenance; explicit retraining required"
            ),
            "baseline_majority_accuracy": baseline,
            "calibration_status": "uncalibrated — use ranking scores, NOT calibrated future cash-out probabilities",
            "threshold_guidance": "threshold trades precision (alert fatigue) against recall (missed cash-outs); "
                                  "set it from investigator capacity and false-positive cost, not from accuracy",
            "intended_use": "decision support with mandatory human review",
            "prohibited_use": "automated enforcement, legal determination, or live operational decisions",
            "holdout_revalidation": holdouts,
        },
    }


@app.get("/api/model/distribution")
def prediction_distribution(user: dict = Depends(require_permission("read"))):
    meta = get_metadata()
    if not meta:
        raise HTTPException(status_code=404, detail="No model trained yet")
    try:
        with open(ml_engine.STATS_PATH, encoding="utf-8") as f:
            stats = json.load(f)
    except FileNotFoundError:
        stats = {}
    return {"feature_stats": stats.get("feature_stats", {}), "total_samples": stats.get("total_samples", 0)}


@app.post("/api/model/detect-anomaly")
def detect_anomaly(req: AnomalyRequest, user: dict = Depends(require_permission("read"))):
    features = {
        "distance_from_victim_km": 3.0,
        "historical_crime_density": 8,
        "time_window_match": 1.0,
        "atm_type_score": 0.7,
        "suspect_distance_km": 4.0,
        "recent_withdrawal_freq": 0.5,
        "amount": req.amount,
        "num_mule_accounts": req.num_mule_accounts,
        "hour": req.hour_of_day,
        "day_of_week": datetime.now().weekday(),
        "transaction_velocity": req.transaction_velocity,
        "proximity_score": 0.6,
        "density_score": 0.5,
        "suspect_proximity": 0.5,
        "amount_factor": min(req.amount / 150000, 1.0),
    }
    result = _predict_or_503(features)
    is_anomaly = result["risk_score"] > 80 or req.amount > 100000 or req.num_mule_accounts >= 5
    return {
        "is_anomaly": is_anomaly,
        "risk_score": result["risk_score"],
        "confidence": result["confidence"],
        "features": features,
    }


@app.get("/api/model/mule-network")
@limiter.limit("10/minute")
def mule_network(request: Request, user: dict = Depends(require_permission("read")), case_id: str = Query(default=None), db: Session = Depends(get_db)):
    """Graph-based mule account detection using NetworkX Louvain communities."""
    try:
        import networkx as nx
        from networkx.algorithms.community import louvain_communities
    except ImportError:
        raise HTTPException(status_code=500, detail="NetworkX not installed")

    cases = visible_cases(db, user).all() if not case_id else [require_case(db, user, case_id)]

    G = nx.DiGraph()
    for c in cases:
        account_ids = [f"ACCT-{c.case_id}-{i}" for i in range(c.linked_accounts)]
        for i, acct in enumerate(account_ids):
            acct_hash = stable_int(acct) % 10000
            G.add_node(acct, risk=c.current_risk, case=c.case_id, balance=round(5000 + (acct_hash % 495001), 2))
            if i > 0:
                G.add_edge(account_ids[i-1], acct, weight=round(0.3 + ((acct_hash * 3) % 701) / 1000.0, 3),
                           amount=round(5000 + (acct_hash % 195001), 2),
                           timestamp=(datetime.now(timezone.utc) - timedelta(hours=1 + (acct_hash % 72))).isoformat())
        if len(account_ids) > 2:
            h_first = stable_int(account_ids[0]) % 10000
            h_last = stable_int(account_ids[-1]) % 10000
            G.add_edge(account_ids[0], account_ids[-1], weight=1.0,
                       amount=round(10000 + (h_first % 290001), 2),
                       timestamp=(datetime.now(timezone.utc) - timedelta(hours=1 + (h_first % 48))).isoformat())
            G.add_edge(account_ids[-1], account_ids[0], weight=0.8,
                       amount=round(5000 + (h_last % 95001), 2),
                       timestamp=(datetime.now(timezone.utc) - timedelta(hours=1 + (h_last % 24))).isoformat())

    if len(G.nodes) == 0:
        return {"nodes": [], "edges": [], "clusters": [], "total_nodes": 0, "total_edges": 0}

    G_undirected = G.to_undirected()
    try:
        communities = louvain_communities(G_undirected, seed=42)
    except Exception:
        communities = list(nx.connected_components(G_undirected))

    clusters = []
    suspicious_accounts = []
    for i, community in enumerate(communities):
        if len(community) < 3:
            continue
        subgraph = G.subgraph(community)
        total_flow = sum(d.get("weight", 0) * d.get("amount", 0) for _, _, d in subgraph.edges(data=True))
        total_txns = len(list(subgraph.edges))
        centrality = nx.degree_centrality(subgraph)
        sorted_centrality = sorted(centrality.items(), key=lambda x: x[1], reverse=True)

        fan_out = {n: subgraph.out_degree(n) for n in community if n in subgraph}
        max_fan_out = max(fan_out.values()) if fan_out else 0

        is_suspicious = len(community) >= 4 and total_flow > 500000 and max_fan_out >= 3

        clusters.append({
            "cluster_id": i + 1,
            "size": len(community),
            "accounts": list(community),
            "total_flow": round(total_flow, 2),
            "total_transactions": total_txns,
            "top_nodes": [{"account": n, "centrality": round(c, 3)} for n, c in sorted_centrality[:3]],
            "max_fan_out": max_fan_out,
            "risk_level": "High" if is_suspicious else "Medium" if len(community) >= 3 else "Low",
        })
        if is_suspicious:
            suspicious_accounts.extend([n for n, _ in sorted_centrality[:2]])

    clusters.sort(key=lambda x: x["size"], reverse=True)

    nodes = [{"id": n, "label": n, "risk": d.get("risk", "Medium"), "case": d.get("case", ""),
              "balance": round(d.get("balance", 0), 2), "cluster": None} for n, d in G.nodes(data=True)]
    for cl in clusters:
        for acct in cl["accounts"]:
            for node in nodes:
                if node["id"] == acct:
                    node["cluster"] = cl["cluster_id"]
                    node["risk_level"] = cl["risk_level"]

    edges = [{"source": u, "target": v, "weight": d.get("weight", 0.5),
              "amount": round(d.get("amount", 0), 2), "timestamp": d.get("timestamp", "")}
             for u, v, d in G.edges(data=True)]

    return {
        "nodes": nodes, "edges": edges, "clusters": clusters,
        "suspicious_accounts": list(set(suspicious_accounts)),
        "total_nodes": len(nodes), "total_edges": len(edges),
        "graph_density": round(nx.density(G), 4) if len(G.nodes) > 1 else 0,
    }


# ─── SHAP-based Model Transparency ────────────────────────────────────────────

@app.post("/api/cases/{case_id}/action")
def case_action(case_id: str, action: dict, user: dict = Depends(require_permission("write")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    valid_types = ["acknowledge", "assign", "request_verification", "escalate", "close"]
    action_type = action.get("type")
    if action_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid action type. Must be one of: {valid_types}")

    case = require_case(db, user, case_id, 'read')

    check_action(user, action_type)
    reason = action.get("reason", "")
    assigned_to = action.get("assigned_to", "")
    actor_name = "{} ({})".format(user.get("name", ""), user["id"])

    if action_type == "close" and not reason:
        raise HTTPException(status_code=400, detail="Reason is required to close a case")

    if action_type == "acknowledge":
        case.status = "investigating"
        case.last_updated = "Just now"
    elif action_type == "assign":
        from models_db import User
        target = db.query(User).filter(User.id == assigned_to, User.is_active == True, User.is_approved == True).first()
        if not target or (case.department and target.department != case.department):
            raise HTTPException(status_code=400, detail="Assignee must be an active approved user in the case department")
        case.assigned_to = target.id
        case.status = "investigating"
        case.last_updated = "Just now"
    elif action_type == "request_verification":
        pass
    elif action_type == "escalate":
        risk_order = {"Low": "Medium", "Medium": "High"}
        new_risk = risk_order.get(case.current_risk)
        if new_risk:
            case.current_risk = new_risk
        case.last_updated = "Just now"
    elif action_type == "close":
        case.status = "resolved"
        case.current_risk = "Resolved"
        case.last_updated = "Just now"

    db.commit()

    details_parts = [f"Case {case_id} — {action_type}"]
    if reason:
        details_parts.append(f"Reason: {reason}")
    if assigned_to:
        details_parts.append(f"Assigned to: {assigned_to}")
    details_parts.append(f"By: {actor_name}")

    add_audit(db, f"Case {action_type.replace('_', ' ').title()}", ". ".join(details_parts), "case_action", case_id)

    return {
        "status": "ok",
        "case_id": case_id,
        "action": action_type,
        "case": {
            "case_id": case.case_id,
            "crime_type": case.crime_type,
            "amount": case.amount,
            "linked_accounts": case.linked_accounts,
            "current_risk": case.current_risk,
            "last_updated": case.last_updated,
            "status": case.status,
        },
    }


@app.get("/api/model/metrics")
@limiter.limit("20/minute")
def model_metrics(request: Request, user: dict = Depends(require_permission("read"))):
    meta = get_metadata()
    if not meta:
        raise HTTPException(status_code=404, detail="No model trained")
    return {
        "data_source": "synthetic benchmark, not verified operational accuracy",
        "ensemble": {key: meta.get(key) for key in ("accuracy", "precision", "recall", "f1_score", "confusion_matrix")},
        "random_forest": {"accuracy": meta.get("rf_accuracy")},
        "xgboost": {"accuracy": meta.get("xgb_accuracy")},
        **{key: meta.get(key) for key in ("roc_auc", "pr_auc", "cv_accuracy", "cv_std", "training_date", "n_samples", "n_features", "cities", "atms")},
    }



@app.get("/api/model/shap/{case_id}")
@limiter.limit("20/minute")
def shap_explanation(request: Request, case_id: str, user: dict = Depends(require_permission("read")), db: Session = Depends(get_db), atm_id: Optional[str] = Query(default=None)):
    require_case(db, user, case_id)
    prediction = db.query(Prediction).filter(Prediction.case_id == case_id).first()
    if prediction is None:
        raise HTTPException(status_code=409, detail="Generate a prediction before requesting an explanation")
    query = db.query(RankedLocation).filter(RankedLocation.prediction_id == prediction.id)
    if atm_id:
        query = query.filter(RankedLocation.atm_id == atm_id)
    selected = query.order_by(RankedLocation.rank).first()
    if selected is None:
        raise HTTPException(status_code=404, detail="Selected ATM prediction not found")
    try:
        snapshot = json.loads(selected.reason)
        features = snapshot["prediction_features"]
        output = snapshot["model_output"]
    except (ValueError, TypeError, KeyError):
        raise HTTPException(status_code=409, detail="Legacy prediction has no exact feature snapshot; generate a fresh prediction")
    try:
        rf, xgb = load_models()
        if rf is None and xgb is None:
            raise ValueError("No model loaded")
        metadata = get_metadata() or {}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Explanation model unavailable") from exc
    if (metadata.get("model_version", "unversioned") != snapshot["model_info"]["model_version"]
            or snapshot["model_info"].get("model_fingerprint") != _current_model_fingerprint()):
        raise HTTPException(status_code=409, detail="Model identity changed; generate a fresh prediction")
    # Content-addressing avoids stale case-only caches for different ATM inputs.
    cache_key = hashlib.sha256(json.dumps({"atm_id": selected.atm_id, **snapshot}, sort_keys=True).encode()).hexdigest()
    try:
        explanation = (explain_cashout(dict(features), case_id=cache_key) if explain_cashout
                       else compute_shap_values(dict(features), case_id=cache_key))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Explanation service unavailable") from exc
    if isinstance(explanation, dict):
        if explanation.get("error_code") == "MODEL_UNAVAILABLE":
            raise HTTPException(status_code=503, detail="Explanation model unavailable")
        contributions = explanation.get("feature_contributions", explanation.get("contributions", []))
        method = explanation.get("shap_method", explanation.get("method", "unavailable"))
        available = bool(contributions) and explanation.get("local_attribution", explanation.get("available", False))
        explained_model = explanation.get("explained_model", "stored ensemble" if available else "global importance; not local SHAP")
        base_value = explanation.get("base_value") if available else None
        if available:
            import math
            probability = explanation.get("probability")
            stored_probability = output.get("probability", selected.risk_score / 100)
            if probability is not None and not math.isclose(probability, stored_probability, rel_tol=1e-5, abs_tol=1e-5):
                raise HTTPException(status_code=409, detail="Explanation does not match stored ensemble output; generate a fresh prediction")
    else:
        contributions = explanation or []
        available = bool(contributions)
        method = "KernelExplainer (RF component only)"
        explained_model = "random_forest; not the stored ensemble score"
        base_value = None
        explanation = {}
    if not contributions:
        contributions = output.get("contributions", [])
        method = "Global feature importance (not local SHAP)" if contributions else "unavailable"
        explained_model = "global importance; not local SHAP"
    return {
        "case_id": case_id, "atm_id": selected.atm_id,
        "risk_score": selected.risk_score, "confidence": output.get("confidence"),
        "prediction_features": features, "model_output": output,
        "model_info": snapshot["model_info"],
        "feature_contributions": contributions, "base_value": base_value,
        "shap_method": method, "shap_available": available,
        "explained_model": explained_model,
        "explanation_units": explanation.get("units"),
        "explanation_reason": explanation.get("reason"),
        "explanation_probability": explanation.get("probability") if available else None,
    }



# ─── Model Drift Detection ────────────────────────────────────────────────────

@app.get("/api/model/drift")
@limiter.limit("10/minute")
def model_drift(request: Request, user: dict = Depends(require_permission("read"))):
    """Illustrative synthetic mean-shift heuristic, not measured live drift."""
    try:
        with open(ml_engine.STATS_PATH, encoding="utf-8") as f:
            stats = json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No training stats available")

    feature_stats = stats.get("feature_stats", {})
    drift_results = []
    random.seed(42)

    for feature, train_stat in feature_stats.items():
        _f_hash = stable_int(feature) % 10000
        live_mean = train_stat["mean"] + ((_f_hash % 200 - 100) / 1000.0) * train_stat["std"] * 0.1
        live_std = train_stat["std"] * (0.9 + (_f_hash % 201) / 1000.0)

        mean_shift = abs(live_mean - train_stat["mean"]) / max(train_stat["std"], 0.001)

        psi = ((live_mean - train_stat["mean"]) ** 2) / max(train_stat["std"] ** 2, 0.001)
        psi = round(psi, 4)

        if psi > 0.25:
            status_drift = "critical"
        elif psi > 0.1:
            status_drift = "warning"
        else:
            status_drift = "stable"

        drift_results.append({
            "feature": feature,
            "train_mean": round(train_stat["mean"], 4),
            "live_mean": round(live_mean, 4),
            "train_std": round(train_stat["std"], 4),
            "live_std": round(live_std, 4),
            "mean_shift_z": round(mean_shift, 2),
            "heuristic_score": psi,
            "status": status_drift,
        })

    drift_results.sort(key=lambda x: x["heuristic_score"], reverse=True)
    overall_psi = round(sum(d["heuristic_score"] for d in drift_results) / len(drift_results), 4) if drift_results else 0

    return {
        "data_source": "synthetic simulated distribution, not live telemetry",
        "metric_method": "heuristic normalized mean shift; not population stability index (PSI)",
        "verified": False,
        "overall_heuristic_score": overall_psi,
        "status": "critical" if overall_psi > 0.25 else "warning" if overall_psi > 0.1 else "stable",
        "features": drift_results,
        "total_features": len(drift_results),
        "critical_count": sum(1 for d in drift_results if d["status"] == "critical"),
        "warning_count": sum(1 for d in drift_results if d["status"] == "warning"),
    }


# ─── Spatial Query Engine ────────────────────────────────────────────────────

@app.get("/api/model/spatial")
def spatial_info(user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    """Return spatial query engine status and capabilities."""
    info = get_spatial_info(db)
    info["postgis_auto_detected"] = USE_POSTGIS
    return info


@app.post("/api/model/spatial/enable-postgis")
def setup_postgis(user: dict = Depends(require_role("admin")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    """Enable PostGIS and add spatial index to ATM locations (admin only)."""
    if not enable_postgis(db):
        raise HTTPException(status_code=500, detail="Failed to enable PostGIS extension")
    if not add_geometry_column(db):
        raise HTTPException(status_code=500, detail="Failed to add geometry column")
    return {"status": "PostGIS enabled", "spatial_index": "created"}


@app.get("/api/model/spatial/nearby")
def find_nearby(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    max_km: float = Query(50, description="Max radius in km"),
    limit: int = Query(8, description="Max results"),
    user: dict = Depends(require_permission("read")),
    db: Session = Depends(get_db),
):
    """Find nearby ATMs using PostGIS spatial index or haversine fallback."""
    results = find_nearby_atms(db, lat, lng, max_km, limit)
    return {
        "center": {"lat": lat, "lng": lng},
        "radius_km": max_km,
        "method": "PostGIS" if USE_POSTGIS else "haversine",
        "count": len(results),
        "atms": results,
    }


# ─── Human Review / Override Workflow ─────────────────────────────────────────

class ReviewAction(BaseModel):
    action: str  # "approve" | "override" | "dismiss"
    reason: str  # min 10 chars, enforced in the handler (after auth/CSRF)
    reviewer_id: str = ""  # compatibility only; authenticated identity is authoritative


@app.get("/api/review/queue")
def get_review_queue(user: dict = Depends(require_permission("read")), status: str = "pending_review", db: Session = Depends(get_db)):
    cases = visible_cases(db, user).filter(Case.status.in_(["active", "investigating"])).all()

    def _dec(val):
        return val or ""

    queue = []
    for c in cases:
        c_hash = stable_int(c.case_id) % 10000
        queue.append({
            "case_id": c.case_id,
            "crime_type": c.crime_type,
            "amount": c.amount,
            "current_risk": c.current_risk,
            "victim_name": (_dec(c.victim_name) or "N/A") if user.get("role") in ("admin", "inspector") else "[REDACTED]",
            "status": "pending_review",
            "assigned_to": c.assigned_to,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=1 + (c_hash % 48))).isoformat(),
            "priority": "Critical" if c.amount > 200000 else "High" if c.amount > 50000 else "Medium",
        })

    queue = [q for q in queue if q["status"] in (status, "pending_review")]
    queue.sort(key=lambda x: {"Critical": 0, "High": 1, "Medium": 2}.get(x["priority"], 3))
    return {"queue": queue, "total": len(queue), "status_filter": status}


@app.post("/api/review/{case_id}")
def review_case(case_id: str, action: ReviewAction, user: dict = Depends(require_permission("write")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    if action.action not in ["approve", "override", "dismiss"]:
        raise HTTPException(status_code=400, detail="Invalid action. Must be: approve, override, dismiss")

    case = require_case(db, user, case_id, 'review')
    if case.status == "resolved":
        raise HTTPException(status_code=409, detail="Case is already resolved; re-review is not allowed")
    # Length is enforced here (not on the model) so missing-CSRF requests
    # still fail with 403 from the dependency before body-shape errors.
    if len(action.reason.strip()) < 10:
        raise HTTPException(status_code=422, detail="Reason must be at least 10 characters")

    review_record = ReviewRecord(
        case_id=case_id,
        action=action.action,
        reason=action.reason.strip(),
        reviewer_id=user["id"],
        previous_risk=case.current_risk,
    )
    db.add(review_record)

    if action.action == "approve":
        case.current_risk = "High"
        case.status = "investigating"
    elif action.action == "override":
        case.current_risk = "Low"
        case.status = "investigating"
    elif action.action == "dismiss":
        case.status = "resolved"
        case.current_risk = "Resolved"

    case.last_updated = "Just now"
    db.commit()
    _invalidate_prediction_caches()

    add_audit(db, f"Case {action.action.title()}d",
              "Case {} {}d by {}. Reason: {}".format(case_id, action.action, user["id"], action.reason.strip()),
              "review", case_id)

    return {"status": "reviewed", "case_id": case_id, "action": action.action,
            "reason": action.reason.strip(), "reviewer_id": user["id"],
            "previous_risk": review_record.previous_risk,
            "timestamp": review_record.created_at.isoformat() if review_record.created_at else None}


@app.get("/api/review/history")
def review_history(user: dict = Depends(require_permission("read")), case_id: str = None, db: Session = Depends(get_db)):
    if case_id:
        require_case(db, user, case_id)
    ids = visible_case_ids(db, user)
    q = db.query(ReviewRecord).filter(ReviewRecord.case_id.in_(list(ids)))
    if case_id:
        q = q.filter(ReviewRecord.case_id == case_id)
    return [
        {
            "case_id": r.case_id, "action": r.action, "reason": r.reason,
            "reviewer_id": r.reviewer_id, "previous_risk": r.previous_risk,
            "timestamp": r.created_at.isoformat() if r.created_at else None,
        }
        for r in q.order_by(ReviewRecord.id.desc()).limit(50).all()
    ]


# ─── Evidence Chain Endpoints ─────────────────────────────────────────────────

@app.post("/api/evidence/anchor")
def anchor_evidence(request: Request, ev: EvidenceAnchor, user: dict = Depends(require_permission("write")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    case = require_case(db, user, ev.case_id, 'evidence')
    idem_key = idempotency_key_from(request)
    if idem_key:
        idem_key = hashlib.sha256((user["id"] + "|" + ev.case_id + "|" + idem_key).encode()).hexdigest()
    if idem_key:
        replay = check_replay(db, idem_key, "POST", "/api/evidence/anchor")
        if replay is not None:
            return replay
    chain = get_evidence_chain()
    result = chain.add_evidence(ev.case_id, ev.evidence_type, ev.content, user["id"])

    # Mirror onto PoW blockchain (auto-mine single tx for demo responsiveness)
    bc = get_blockchain()
    tx = bc.add_transaction(
        tx_type="evidence_anchor",
        payload={
            "evidence_block_id": result.get("block_id"),
            "evidence_hash": result.get("evidence_hash"),
            "evidence_type": ev.evidence_type,
            "officer_id": user["id"],
            "content_preview": seal(ev.content[:120]),
        },
        case_id=ev.case_id,
    )
    mined = bc.mine_pending(miner="node-cybercell-mumbai")
    result["blockchain"] = {"tx": tx, "mined": mined}
    if idem_key:
        store_replay(db, idem_key, "POST", "/api/evidence/anchor", 200, result)
    return result


@app.get("/api/evidence/export-pdf/{case_id}")
def export_case_diary_pdf(case_id: str, user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    """Printable Case Diary PDF (Sec. 63 BSA format): Merkle root, block hashes, timestamps, officer."""
    require_case(db, user, case_id)
    from fpdf import FPDF

    def _latin(value) -> str:
        return str(value if value is not None else "").encode("latin-1", "replace").decode("latin-1")

    chain = get_evidence_chain()
    blocks = chain.get_chain(case_id)
    if not blocks:
        raise HTTPException(status_code=404, detail="No evidence anchored for this case")

    pdf = FPDF(format="A4")
    pdf.set_compression(False)  # keep certificate text searchable/inspectable
    pdf.set_auto_page_break(True, margin=20)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Case Diary - Electronic Record Integrity Statement (Sec. 63 BSA format)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 7, _latin(f"Case ID: {case_id}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, _latin(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} by {user.get('email', '?')} ({user.get('role', '?')})"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, _latin(f"Merkle root: {chain.merkle_root or 'n/a'}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, _latin(f"Blocks: {len(blocks)}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Anchored blocks", new_x="LMARGIN", new_y="NEXT")
    for b in blocks:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, _latin(f"Block #{b.get('block_id')} - {b.get('evidence_type', 'evidence')} - {b.get('timestamp_human', '')}"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, _latin(f"block_hash: {b.get('block_hash', '')}\nprev_hash: {b.get('previous_hash', '')}\nofficer: {b.get('officer_id', '')}"))
        pdf.ln(2)
    pdf.set_font("Helvetica", "I", 9)
    pdf.multi_cell(0, 5, "Verification: recompute SHA-256 over each block payload and compare with block_hash; "
        "check each prev_hash links to the previous block_hash; rebuild the Merkle root from leaf hashes "
        "and compare with the root above.")
    data = bytes(pdf.output())
    add_audit(
        db, "Evidence Exported",
        f"Case diary PDF exported for {case_id} ({len(blocks)} blocks) by {user.get('email', '?')}",
        "evidence", case_id,
    )
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="case-diary-{case_id}.pdf"'},
    )


@app.get("/api/notifications/jobs")
def list_notification_jobs(user: dict = Depends(require_role("admin")),
                           status: str = Query(default=None),
                           limit: int = Query(default=50, ge=1, le=200),
                           db: Session = Depends(get_db)):
    """Durable notification dispatch states: queued|sending|sent|failed|dead."""
    q = db.query(NotificationJob).order_by(NotificationJob.id.desc())
    if status:
        q = q.filter(NotificationJob.status == status)
    return [
        {
            "id": j.id, "kind": j.kind, "status": j.status,
            "attempts": j.attempts, "max_attempts": j.max_attempts,
            "last_error": j.last_error,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in q.limit(limit).all()
    ]


# ─── Data Retention ───────────────────────────────────────────────────────────

RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "365"))


@app.get("/api/admin/retention")
def get_retention_policy(user: dict = Depends(require_role("admin"))):
    """Documented retention policy — purging is explicit (POST), never automatic."""
    return {
        "audit_log_days": RETENTION_DAYS,
        "idempotency_key_hours": 24,
        "notification_job_days": RETENTION_DAYS,
        "refresh_token": "expired/revoked tokens pruned every 10 minutes",  # nosec B105 (descriptive text, not a credential)
        "enforcement": "manual purge endpoint for admins; no automatic deletion of case data",
    }


@app.post("/api/admin/retention/purge")
def retention_purge(
    user: dict = Depends(require_role("admin")),
    csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
    days: int = Query(default=RETENTION_DAYS, ge=7, le=3650),
):
    """Delete audit/notification/idempotency rows older than `days` days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    purged = {}

    purged["audit_logs"] = (
        db.query(AuditLog).filter(AuditLog.timestamp < cutoff).delete(synchronize_session=False)
    )
    purged["notification_jobs"] = (
        db.query(NotificationJob)
        .filter(NotificationJob.created_at < cutoff, NotificationJob.status.in_(["sent", "dead"]))
        .delete(synchronize_session=False)
    )
    # Never touch cases, predictions, alerts, evidence, or field outcomes.
    purged["idempotency_keys"] = (
        db.query(IdempotencyKey)
        .filter(IdempotencyKey.created_at < datetime.now(timezone.utc) - timedelta(hours=24))
        .delete(synchronize_session=False)
    )
    db.commit()

    add_audit(
        db, "Retention Purge",
        f"Admin {user.get('email', '?')} purged rows older than {days} days: "
        + ", ".join(f"{k}={v}" for k, v in purged.items()),
        "system",
    )
    return {"purged": purged, "days": days, "note": "Case/evidence/alert records are never purged."}


# ─── Blockchain Endpoints ────────────────────────────────────────────────────

@app.get("/api/blockchain/status")
def blockchain_status(user: dict = Depends(require_permission("read"))):
    bc = get_blockchain()
    net = get_network()
    return {"primary": bc.get_status(), "network": net.status()}


@app.get("/api/blockchain/chain")
def blockchain_chain(user: dict = Depends(require_role("admin")), limit: int = Query(default=50, le=200)):
    bc = get_blockchain()
    chain = bc.get_chain()
    return {
        "chain": chain[-limit:],
        "height": len(chain),
        "difficulty": bc.difficulty,
        "validation": Blockchain.validate_chain(chain),
    }


@app.get("/api/blockchain/validate")
def blockchain_validate(user: dict = Depends(require_permission("read"))):
    bc = get_blockchain()
    result = Blockchain.validate_chain(bc.get_chain())
    result["stored_rows"] = getattr(bc, "stored_rows", len(bc.chain))
    result["corrupt_rows_skipped"] = getattr(bc, "corrupt_rows", 0)
    result["degraded"] = getattr(bc, "degraded", False)
    return result


@app.post("/api/blockchain/mine")
def blockchain_mine(
    user: dict = Depends(require_role("admin")),
    csrf: None = Depends(require_csrf),
    miner: str = Query(default="node-cybercell-mumbai"),
):
    bc = get_blockchain()
    return bc.mine_pending(miner=miner)


@app.post("/api/blockchain/consensus")
def blockchain_consensus(
    user: dict = Depends(require_role("admin")),
    csrf: None = Depends(require_csrf),
):
    return get_network().consensus()


@app.get("/api/evidence/verify/{block_id}")
def verify_evidence(block_id: int, user: dict = Depends(require_permission("read")), content: str = Query(...), db: Session = Depends(get_db)):
    chain = get_evidence_chain()
    block = next((b for b in chain.evidence_blocks if b["block_id"] == block_id), None)
    if block is None:
        raise HTTPException(status_code=404, detail="Evidence block not found")
    try:
        require_case(db, user, block["case_id"])
    except HTTPException:
        # The block exists but its case binding is broken. If the case itself
        # exists and is merely outside this user's visibility, stay silent
        # (404) to preserve department boundaries. If it resolves to nothing
        # at all, the binding was altered: report tampering, not absence.
        case_exists = db.query(Case).filter(Case.case_id == block.get("case_id")).first() is not None
        if not case_exists:
            return {"valid": False, "integrity": "tampered",
                    "detail": "Block's case binding does not resolve to any case",
                    "block_id": block_id}
        raise
    return chain.verify_evidence(block_id, content)


@app.get("/api/evidence/chain")
def get_evidence_chain_list(user: dict = Depends(require_permission("read")), case_id: str = Query(default=None), limit: int = Query(default=200, ge=1, le=1000), db: Session = Depends(get_db)):
    if case_id:
        require_case(db, user, case_id)
    chain = get_evidence_chain()
    ids = visible_case_ids(db, user)
    blocks = chain.get_chain(case_id, allowed_case_ids=ids)
    return {"blocks": blocks[-limit:], "stats": {
        "total_blocks": len(blocks), "cases_covered": sorted({b["case_id"] for b in blocks}),
        "merkle_root": chain.merkle_root,
        "stored_blocks": len(chain.evidence_blocks),
        "corrupt_blocks_skipped": getattr(chain, "corrupt_blocks", 0),
        "degraded": getattr(chain, "degraded", False),
    }}


@app.get("/api/evidence/proof/{block_id}")
def get_merkle_proof(block_id: int, user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    chain = get_evidence_chain()
    _require_evidence_block(chain, block_id, db, user)
    return chain.get_merkle_proof(block_id)


def _require_evidence_block(chain, block_id, db, user):
    block = next((b for b in chain.evidence_blocks if b["block_id"] == block_id), None)
    if block is None:
        raise HTTPException(status_code=404, detail="Evidence block not found")
    require_case(db, user, block["case_id"])


@app.get("/api/stats/nationwide")
def nationwide_stats(user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    total_cases = visible_cases(db, user).count()
    active_alerts = db.query(Alert).join(Case).filter(visibility_filter(user), Alert.acknowledged == False).count()
    return {
        "total_cases": total_cases,
        "active_alerts": active_alerts,
        "cities_covered": len(CITIES),
        "total_atms": sum(len(c["atms"]) for c in CITIES.values()),
        "model_accuracy": get_metadata().get("accuracy") if get_metadata() else None,
    }


# ─── Field Outcomes (Ground Truth Resolution) ────────────────────────────────

class FieldOutcomeRequest(BaseModel):
    case_id: str
    atm_id: str
    outcome: str  # apprehended, cash_recovered, transaction_prevented, false_positive
    notes: str = ""

@app.post("/api/field-outcomes")
def record_field_outcome(req: FieldOutcomeRequest, user: dict = Depends(require_permission("write")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    if req.outcome not in ["apprehended", "cash_recovered", "transaction_prevented", "false_positive"]:
        raise HTTPException(status_code=400, detail="Invalid outcome type")

    case = require_case(db, user, req.case_id, "field_outcome")
    outcome = FieldOutcome(
        case_id=req.case_id,
        atm_id=req.atm_id,
        outcome=req.outcome,
        officer_id=user["id"],
        notes=req.notes,
    )
    db.add(outcome)

    # Update the previously authorized case based on the reported outcome.
    if case:
        if req.outcome in ["apprehended", "cash_recovered", "transaction_prevented"]:
            case.status = "resolved"
            case.current_risk = "Resolved"
        elif req.outcome == "false_positive":
            case.current_risk = "Low"
        case.last_updated = "Just now"

    db.commit()

    # Audit log
    outcome_labels = {
        "apprehended": "Suspect Apprehended",
        "cash_recovered": "Cash Recovered",
        "transaction_prevented": "Transaction Prevented",
        "false_positive": "False Positive (Model Retraining Signal)",
    }
    add_audit(db, outcome_labels[req.outcome],
              f"Case {req.case_id} at {req.atm_id}: {req.outcome}. Officer: {user['id']}. "
              f"Model version: {get_metadata().get('model_version', 'unversioned') if get_metadata() else 'unversioned'}. "
              f"{req.notes}",
              "field_outcome", req.case_id)

    # Recording feedback does not retrain or recalibrate a model.
    recalibrated = False

    return {
        "status": "recorded",
        "outcome_id": outcome.id,
        "case_id": req.case_id,
        "outcome": req.outcome,
        "model_recalibrated": recalibrated,
    }

@app.get("/api/field-outcomes")
def list_field_outcomes(user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    outcomes = db.query(FieldOutcome).join(Case).filter(visibility_filter(user)).order_by(FieldOutcome.created_at.desc()).limit(50).all()
    return [
        {"id": o.id, "case_id": o.case_id, "atm_id": o.atm_id, "outcome": o.outcome,
         "officer_id": o.officer_id, "notes": o.notes, "created_at": o.created_at.isoformat() if o.created_at else None}
        for o in outcomes
    ]


# ─── Pre-Baked Scenario Runner ───────────────────────────────────────────────

SCENARIOS = {
    "fast_upi_layering": {
        "name": "Fast UPI Layering",
        "description": "₹1,25,000 split across 6 mule accounts in 2 hours. Classic layering pattern.",
        "case_id": "CC-2026-0145",
        "city": "puducherry",
        "steps": [
            "Complaint filed via cybercrime.gov.in",
            "ML engine identifies 6 linked mule accounts",
            "Risk prediction: ATM-005 (Kurumbapet Highway) — 88% risk",
            "Temporal pattern: 19:00-21:00 evening cash-out window",
            "Alert broadcast to all connected officers",
        ],
    },
    "sim_swap_cashout": {
        "name": "SIM-Swap Cashout",
        "description": "₹92,000 drained after SIM port. OTP interception enabled 3 account compromises.",
        "case_id": "CC-2026-0138",
        "city": "puducherry",
        "steps": [
            "SIM swap detected via telecom integration",
            "3 bank accounts compromised via intercepted OTPs",
            "ML engine flags ATM-027 (White Town) — 85% risk",
            "Geographic clustering within 2km radius",
            "QRT dispatched to monitor predicted ATMs",
        ],
    },
    "card_skimming_ring": {
        "name": "Card Skimming Ring",
        "description": "₹35,200 withdrawn at 2 ATMs within 30 minutes. Skimmer device suspected.",
        "case_id": "CC-2026-0146",
        "city": "chennai",
        "steps": [
            "Card details skimmed at ATM-014 (MG Road)",
            "Two rapid withdrawals of ₹15,000 and ₹20,200",
            "ML identifies temporal proximity pattern",
            "Risk score: 85% at MG Road Commercial",
            "Bank nodal officer notified for card freeze",
        ],
    },
}

@app.get("/api/scenarios")
def list_scenarios(user: dict = Depends(require_permission("read"))):
    return [{"id": k, "name": v["name"], "description": v["description"]} for k, v in SCENARIOS.items()]

@app.get("/api/scenarios/{scenario_id}")
def get_scenario(scenario_id: str, user: dict = Depends(require_permission("read")), db: Session = Depends(get_db)):
    scenario = SCENARIOS.get(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Get live prediction for the scenario's case
    prediction = get_predictions_for_case(scenario["case_id"], db)

    return {
        **scenario,
        "prediction": prediction,
    }


# ─── NLP Complaint Triage ─────────────────────────────────────────────────────

def _extract_triage_entities(raw_text: str, text: str, amount_match) -> list:
    """Amount (multi-format INR), bank, location, platform and UPI-ID entities."""
    import re
    entities = []
    if amount_match:
        entities.append({"type": "AMOUNT", "value": amount_match.group(0)})
    for bank in ["SBI", "HDFC", "ICICI", "Axis", "PNB", "BOB"]:
        if bank.lower() in text:
            entities.append({"type": "BANK", "value": bank})
    for city in ["chennai", "delhi", "pune", "mumbai", "bangalore", "hyderabad"]:
        if city in text:
            entities.append({"type": "LOCATION", "value": city.title()})
    for platform in ["telegram", "whatsapp", "instagram", "facebook"]:
        if platform in text:
            entities.append({"type": "PLATFORM", "value": platform.title()})
    vpa = re.search(r"\b[\w.\-]{2,}@[a-z]{2,}\b", raw_text, re.IGNORECASE)
    if vpa:
        entities.append({"type": "UPI_ID", "value": vpa.group(0)})
    return entities

class ComplaintText(BaseModel):
    text: str = Field(min_length=10, max_length=5000)

CRIME_KEYWORDS = {
    "vishing": ["otp", "called", "sharing", "phone call", "fake call", "claimed to be"],
    "card_cloning": ["credit card", "debit card", "cloned", "skimming", "card used"],
    "investment_fraud": ["invest", "crypto", "trading", "app", "telegram", "returns"],
    "upi_fraud": ["upi", "pin", "gpay", "phonepe", "paytm", "qr code"],
    "advance_fee": ["lottery", "won", "processing fee", "prize", "winner"],
    "phishing": ["email", "link", "website", "login", "password", "clicked"],
    "identity_theft": ["aadhaar", "pan card", "identity", "documents", "fake account"],
}

CRIME_LABELS = {
    "vishing": "Vishing / Social Engineering",
    "card_cloning": "Card Cloning / Skimming",
    "investment_fraud": "Investment Fraud",
    "upi_fraud": "UPI Fraud",
    "advance_fee": "Advance Fee Fraud",
    "phishing": "Phishing",
    "identity_theft": "Identity Theft",
}

@app.post("/api/nlp/triage")
def triage_complaint(req: ComplaintText, user: dict = Depends(require_permission("read"))):
    text = req.text.lower()
    scores = {}
    for crime, keywords in CRIME_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[crime] = score

    # Words indicating the reporter believes wrongdoing occurred. Zero keyword
    # hits *plus* none of these means no cybercrime signal at all — route out
    # of scope instead of mislabeling weather reports and lost dogs as fraud.
    CONCERN_LEXICON = [
        "report", "suspicious", "fraud", "scam", "money", "account", "bank",
        "police", "complaint", "stolen", "lost", "victim", "crime", "cyber",
        "fir", "theft", "hack", "frozen", "blocked", "deducted", "transferred",
        "withdraw", "cheat", "fake",
    ]

    if not scores:
        if not any(w in text for w in CONCERN_LEXICON):
            return {
                "category": "Non-Cybercrime",
                "keyword_match_score": 0.0,
                "confidence_note": "No cybercrime indicators found; routed out of scope",
                "priority": "Low",
                "estimated_loss": "Unknown",
                "entities": _extract_triage_entities(req.text, text, None),
                "suggested_action": "No action required. Route to general grievance cell if needed.",
                "crime_key": None,
            }
        category = "General Cyber Fraud"
        keyword_score = 0.55
        crime_key = None
    else:
        crime_key = max(scores, key=scores.get)
        category = CRIME_LABELS.get(crime_key, "Unknown")
        keyword_score = min(0.6 + scores[crime_key] * 0.1, 0.95)

    import re
    amount_match = re.search(
        r"(?:₹|Rs\.?|INR|rupees?)\s*([\d,]+(?:\.\d+)?)|([\d,]+)\s*(?:rupees?|rupay)",
        req.text, re.IGNORECASE)
    amount = amount_match.group(0) if amount_match else "Unknown"

    # Strip the currency marker first via the capture groups: scrubbing the
    # full match would keep the dot in "Rs." (".250000" -> 0.25 -> 0).
    num_part = ""
    if amount_match:
        num_part = (amount_match.group(1) or amount_match.group(2) or "").replace(",", "")
    try:
        numeric = int(float(num_part)) if num_part else 0
    except ValueError:
        numeric = 0
    if numeric > 200000:
        priority = "Critical"
    elif numeric > 50000:
        priority = "High"
    elif numeric > 10000:
        priority = "Medium"
    else:
        priority = "Low"

    entities = _extract_triage_entities(req.text, text, amount_match)

    actions = {
        "vishing": "File FIR under IT Act Section 66D. Block compromised account.",
        "card_cloning": "Block card immediately. Request chargeback. File bank fraud report.",
        "investment_fraud": "Report to SEBI and Cyber Crime Portal. Freeze suspect accounts.",
        "upi_fraud": "Block UPI ID. File complaint on cybercrime.gov.in. Contact bank.",
        "advance_fee": "Report to Cyber Crime Portal. No real prize exists. Warn others.",
        "phishing": "Change all passwords. Enable 2FA. Report phishing URL.",
        "identity_theft": "Freeze Aadhaar/biometrics. File FIR. Monitor credit report.",
    }

    return {
        "category": category,
        "keyword_match_score": round(keyword_score, 2),
        "confidence_note": "Keyword-based heuristic, not a calibrated ML model",
        "priority": priority,
        "estimated_loss": amount,
        "entities": entities,
        "suggested_action": actions.get(crime_key, "File FIR under IT Act Section 66D.") if crime_key else "File FIR under IT Act Section 66D.",
        "crime_key": crime_key,
    }


# ─── SPA Catch-All ──────────────────────────────────────────────────────────

import os

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    from pathlib import Path
    from urllib.parse import unquote
    root = Path(FRONTEND_DIR).resolve()
    decoded = unquote(full_path).replace("\\", "/")
    if "\x00" in decoded or ":" in decoded or decoded.startswith("/") or ".." in decoded.split("/"):
        raise HTTPException(status_code=404, detail="Not found")
    file_path = (root / decoded).resolve()
    if not file_path.is_relative_to(root):
        raise HTTPException(status_code=404, detail="Not found")
    if decoded == "api" or decoded.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    if decoded and file_path.is_file():
        return FileResponse(file_path)
    index = (root / "index.html").resolve()
    if index.is_relative_to(root) and index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn
    ssl_certfile = os.getenv("SSL_CERTFILE", "")
    ssl_keyfile = os.getenv("SSL_KEYFILE", "")
    ssl_kwargs = {}
    if ssl_certfile and ssl_keyfile:
        ssl_kwargs = {"ssl_certfile": ssl_certfile, "ssl_keyfile": ssl_keyfile}
        print(f"[ATLAS] TLS enabled — cert: {ssl_certfile}")
    else:
        print("[ATLAS] WARNING: TLS not configured — set SSL_CERTFILE and SSL_KEYFILE for production")
    uvicorn.run(app, host="0.0.0.0", port=8000, access_log=True, **ssl_kwargs)  # nosec B104 (local demo entrypoint; production terminates TLS upstream)
