"""
ML Prediction Engine v2 — Ensemble + Drift + Anomaly + Graph
Supports Random Forest + XGBoost ensemble with per-prediction explainability.
"""
import joblib
import json
import os
import time
import hashlib
import numpy as np
import pandas as pd
from collections import deque
from typing import Optional
import warnings
warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(__file__)
MODEL_DIR = os.path.join(BASE_DIR, "model")
RF_PATH = os.path.join(MODEL_DIR, "cashout_predictor.pkl")
XGB_PATH = os.path.join(MODEL_DIR, "xgboost_predictor.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "metadata.json")
STATS_PATH = os.path.join(MODEL_DIR, "dataset_stats.json")

FEATURE_COLS = [
    "distance_from_victim_km", "historical_crime_density", "time_window_match",
    "atm_type_score", "suspect_distance_km", "recent_withdrawal_freq",
    "amount", "num_mule_accounts", "hour", "day_of_week",
    "transaction_velocity", "proximity_score", "density_score",
    "suspect_proximity", "amount_factor"
]

FEATURE_NAMES_CN = {
    "distance_from_victim_km": "Victim Distance",
    "historical_crime_density": "Crime Density",
    "time_window_match": "Time Window Fit",
    "atm_type_score": "ATM Risk Profile",
    "suspect_distance_km": "Suspect Distance",
    "recent_withdrawal_freq": "Withdrawal Freq",
    "amount": "Transaction Amount",
    "num_mule_accounts": "Mule Accounts",
    "hour": "Hour of Day",
    "day_of_week": "Day of Week",
    "transaction_velocity": "Velocity",
    "proximity_score": "Proximity",
    "density_score": "Area Density",
    "suspect_proximity": "Suspect Proximity",
    "amount_factor": "Amount Factor",
}

_rf_model = None
_xgb_model = None
_metadata = None
_dataset_stats = None
_shap_explainer = None
_shap_background = None
_shap_cache: dict[str, dict] = {}  # model + background + ordered input, never case ID
_shap_explainer_key = None
_shap_error = None

# Drift monitoring: rolling window of recent predictions
_prediction_log = deque(maxlen=500)
_anomaly_log = deque(maxlen=200)
_prediction_counter = 0


def load_models():
    global _rf_model, _xgb_model, _metadata, _dataset_stats
    if _rf_model is None and os.path.exists(RF_PATH):
        _rf_model = joblib.load(RF_PATH)
    if _xgb_model is None and os.path.exists(XGB_PATH):
        _xgb_model = joblib.load(XGB_PATH)
    if _metadata is None and os.path.exists(METADATA_PATH):
        with open(METADATA_PATH) as f:
            _metadata = json.load(f)
    if _dataset_stats is None and os.path.exists(STATS_PATH):
        with open(STATS_PATH) as f:
            _dataset_stats = json.load(f)
    return _rf_model, _xgb_model


def ensemble_probability(rf, xgb, X):
    """The exact, unrounded serving probability, also used by SHAP."""
    models = [model for model in (rf, xgb) if model is not None]
    if not models:
        raise ValueError("MODEL_UNAVAILABLE: no fitted estimators")
    X = pd.DataFrame(X, columns=FEATURE_COLS)
    return np.mean([model.predict_proba(X)[:, 1] for model in models], axis=0)


def _explanation_model_key(rf, xgb):
    return joblib.hash((rf, xgb, (_metadata or {}).get("shap_background")))


def _init_shap_explainer():
    """Kernel SHAP explains the full ensemble with actual training rows.

    No independent normal/uniform feature synthesis: those rows violate feature
    dependencies and categorical/range constraints. Legacy artifacts lacking
    saved empirical background explicitly fall back to global importance.
    """
    global _shap_explainer, _shap_background, _shap_explainer_key, _shap_error
    try:
        import shap
        rf, xgb = load_models()
        if rf is None and xgb is None:
            raise ValueError("MODEL_UNAVAILABLE: no fitted estimators")
        key = _explanation_model_key(rf, xgb)
        if _shap_explainer is not None and _shap_explainer_key == key:
            return _shap_explainer
        records = (_metadata or {}).get("shap_background")
        if not records:
            raise ValueError("No empirical training background saved; retraining required for local SHAP")
        background = pd.DataFrame(records)[FEATURE_COLS]
        if background.empty or not np.isfinite(background.to_numpy(dtype=float)).all():
            raise ValueError("Invalid empirical background")
        if not (background.time_window_match == background.hour.between(17, 22).astype(float)).all():
            raise ValueError("Background uses incompatible time-window semantics")
        _shap_background = background
        _shap_explainer = shap.KernelExplainer(
            lambda values: ensemble_probability(rf, xgb, values), background,
        )
        _shap_explainer_key = key
        _shap_error = None
        return _shap_explainer
    except Exception as exc:
        _shap_error = str(exc)
        return None


def _positive_shap_values(raw):
    """Support scalar output and old/new SHAP binary classifier layouts."""
    if isinstance(raw, list):
        raw = raw[1] if len(raw) == 2 else raw[0]
    values = np.asarray(raw, dtype=float)
    if values.ndim == 3 and values.shape == (1, len(FEATURE_COLS), 2):
        values = values[0, :, 1]
    elif values.ndim == 3 and values.shape == (1, len(FEATURE_COLS), 1):
        values = values[0, :, 0]
    elif values.ndim == 2 and values.shape == (1, len(FEATURE_COLS)):
        values = values[0]
    if values.shape != (len(FEATURE_COLS),) or not np.isfinite(values).all():
        raise ValueError(f"Unexpected SHAP shape/values: {values.shape}")
    return values


def explain_cashout(features: dict, case_id: str = None) -> dict:
    """Structured explanation; base and signed contributions use probability units.

    Kernel SHAP is a sampled attribution of the exact ensemble function, not an
    exact enumeration of all coalitions. Global MDI fallback is NOT local SHAP.
    case_id is accepted for compatibility but never determines the cache key.
    """
    from copy import deepcopy
    try:
        rf, xgb = load_models()
    except Exception as exc:
        return {"available": False, "local_attribution": False, "base_value": None,
                "contributions": [], "method": "unavailable",
                "error": f"Model loading failed: {exc}", "error_code": "MODEL_UNAVAILABLE"}
    if rf is None and xgb is None:
        return {"available": False, "local_attribution": False, "base_value": None,
                "contributions": [], "method": "unavailable",
                "error": "No models loaded", "error_code": "MODEL_UNAVAILABLE"}
    X = pd.DataFrame([[features.get(col, 0) for col in FEATURE_COLS]], columns=FEATURE_COLS)
    key = hashlib.sha256((_explanation_model_key(rf, xgb) + joblib.hash(X)).encode()).hexdigest()
    if key in _shap_cache:
        return deepcopy(_shap_cache[key])
    try:
        explainer = _init_shap_explainer()
        if explainer is None:
            raise ValueError(_shap_error or "SHAP explainer unavailable")
        values = _positive_shap_values(explainer.shap_values(X, nsamples=256))
        expected = np.asarray(explainer.expected_value, dtype=float).reshape(-1)
        base = float(expected[1] if len(expected) == 2 else expected[0])
        probability = float(ensemble_probability(rf, xgb, X)[0])
        if not np.isfinite(base) or not np.isclose(base + values.sum(), probability, atol=1e-5):
            raise ValueError("SHAP additivity does not match serving ensemble probability")
        contributions = [{
            "feature": col, "label": FEATURE_NAMES_CN.get(col, col),
            "value": float(X.iloc[0][col]), "shap_value": float(values[i]),
            "contribution": float(values[i]), "abs_contribution": float(abs(values[i])),
            "direction": "positive" if values[i] > 0 else "negative" if values[i] < 0 else "neutral",
        } for i, col in enumerate(FEATURE_COLS)]
        contributions.sort(key=lambda item: item["abs_contribution"], reverse=True)
        result = {"available": True, "local_attribution": True,
                  "base_value": base, "probability": probability,
                  "contributions": contributions, "method": "kernel_shap_ensemble",
                  "units": "probability", "background": "empirical_training_rows"}
        _shap_cache[key] = result
        if len(_shap_cache) > 200:
            del _shap_cache[next(iter(_shap_cache))]
        return deepcopy(result)
    except Exception as exc:
        contributions = _ensemble_global_importance(X, rf, xgb)
        return {"available": False, "local_attribution": False, "base_value": None,
                "contributions": contributions, "method": "global_feature_importance",
                "reason": str(exc), "units": "global_importance_not_local_attribution"}


def compute_shap_values(features: dict, case_id: str = None) -> list:
    """Legacy wrapper: only returns genuine local SHAP, never global fallback.

    New callers must use explain_cashout to obtain the true expected value/method.
    """
    result = explain_cashout(features, case_id)
    return result["contributions"] if result.get("local_attribution") else []


def get_metadata():
    load_models()
    return _metadata


def _compute_feature_contributions(X: pd.DataFrame, model) -> list:
    """Global MDI importance only; feature values do not create local attributions."""
    if not hasattr(model, 'feature_importances_'):
        return []
    importances = model.feature_importances_
    values = X.iloc[0].values
    contributions = []
    for i, col in enumerate(FEATURE_COLS):
        contributions.append({
            "feature": col,
            "label": FEATURE_NAMES_CN.get(col, col),
            "value": round(float(values[i]), 4),
            "importance": round(float(importances[i]), 4),
            "contribution": None,
            "direction": "not_local",
            "method": "global_feature_importance",
        })
    contributions.sort(key=lambda x: x["importance"], reverse=True)
    return contributions


def _ensemble_global_importance(X, rf, xgb):
    models = [m for m in (rf, xgb) if m is not None and hasattr(m, "feature_importances_")]
    if not models:
        return []
    importances = np.mean([m.feature_importances_ for m in models], axis=0)
    return sorted([{
        "feature": col, "label": FEATURE_NAMES_CN.get(col, col),
        "value": float(X.iloc[0][col]), "importance": float(importances[i]),
        "contribution": None, "direction": "not_local", "method": "global_feature_importance",
    } for i, col in enumerate(FEATURE_COLS)], key=lambda item: item["importance"], reverse=True)


def _check_drift(X: pd.DataFrame) -> dict:
    """Compare current feature distribution to training distribution."""
    if _dataset_stats is None:
        return {"drifted": False, "features": []}

    drifted_features = []
    for col in FEATURE_COLS:
        if col not in _dataset_stats.get("feature_stats", {}):
            continue
        train_mean = _dataset_stats["feature_stats"][col]["mean"]
        train_std = _dataset_stats["feature_stats"][col]["std"]
        current_val = float(X.iloc[0][col])
        if train_std > 0:
            z_score = abs(current_val - train_mean) / train_std
            if z_score > 2.5:
                drifted_features.append({
                    "feature": col,
                    "label": FEATURE_NAMES_CN.get(col, col),
                    "current": round(current_val, 4),
                    "train_mean": round(train_mean, 4),
                    "z_score": round(z_score, 2),
                })

    return {
        "drifted": len(drifted_features) > 0,
        "count": len(drifted_features),
        "features": drifted_features,
    }


def _log_prediction(risk_score: float, X: pd.DataFrame, case_id: str = ""):
    global _prediction_counter
    _prediction_counter += 1
    entry = {
        "timestamp": time.time(),
        "risk_score": risk_score,
        "case_id": case_id,
        "features": {col: float(X.iloc[0][col]) for col in FEATURE_COLS},
    }
    _prediction_log.append(entry)


def predict_cashout(features: dict, case_id: str = "") -> dict:
    try:
        rf, xgb = load_models()
    except Exception as exc:
        return {"error": f"Model loading failed: {exc}", "error_code": "MODEL_UNAVAILABLE",
                "available": False, "risk_score": None, "confidence": None, "prediction": None}
    if rf is None and xgb is None:
        return {"error": "No models loaded", "error_code": "MODEL_UNAVAILABLE",
                "available": False, "risk_score": None, "confidence": None, "prediction": None}

    X = pd.DataFrame([[features.get(col, 0) for col in FEATURE_COLS]], columns=FEATURE_COLS)

    results = {}
    weights = {}

    # Random Forest prediction
    if rf is not None:
        rf_prob = rf.predict_proba(X)[0][1]
        results["random_forest"] = {
            "probability": round(float(rf_prob), 4),
            "risk_score": round(float(rf_prob * 100), 1),
            "prediction": 1 if rf_prob >= 0.5 else 0,
        }
        weights["random_forest"] = 0.5

    # XGBoost prediction
    if xgb is not None:
        xgb_prob = xgb.predict_proba(X)[0][1]
        results["xgboost"] = {
            "probability": round(float(xgb_prob), 4),
            "risk_score": round(float(xgb_prob * 100), 1),
            "prediction": 1 if xgb_prob >= 0.5 else 0,
        }
        weights["xgboost"] = 0.5

    # Ensemble (weighted average)
    total_weight = sum(weights.values())
    weights = {name: weight / total_weight for name, weight in weights.items()}
    ensemble_prob = float(ensemble_probability(rf, xgb, X)[0])

    # Cheap global diagnostics only; local attribution is explicitly opt-in.
    contributions = _ensemble_global_importance(X, rf, xgb)

    # Drift check
    drift = _check_drift(X)

    # Ranking score is not a calibrated probability or operational confidence.
    risk_score = round(float(ensemble_prob * 100), 1)
    _log_prediction(risk_score, X, case_id)

    return {
        "model_version": _metadata.get("model_version", "unversioned") if _metadata else "unversioned",
        "available": True,
        "risk_score": risk_score,
        "probability": ensemble_prob,
        "prediction": 1 if ensemble_prob >= 0.5 else 0,
        "contributions_method": "global_feature_importance_not_local_attribution",
        "confidence": round(float(max(ensemble_prob, 1 - ensemble_prob) * 100), 1),
        "ensemble": results,
        "model_weights": weights,
        "contributions": contributions,
        "drift": drift,
    }


def get_model_card() -> dict:
    load_models()
    card = {
        "models": [],
        "ensemble_method": "weighted_average",
        "ensemble_weights": {"random_forest": 0.5, "xgboost": 0.5},
        "total_predictions": _prediction_counter,
        "training_date": _metadata.get("training_date", "unknown") if _metadata else "unknown",
        "model_version": _metadata.get("model_version", "unversioned") if _metadata else "unversioned",
        "top_k_accuracy": _metadata.get("top_k_accuracy") if _metadata else None,
    }

    if _rf_model is not None:
        card["models"].append({
            "name": "Random Forest",
            "type": "RandomForestClassifier",
            "params": {
                "n_estimators": getattr(_rf_model, 'n_estimators', 200),
                "max_depth": getattr(_rf_model, 'max_depth', 10),
            },
            "accuracy": _metadata.get("accuracy", 0) if _metadata else 0,
        })

    if _xgb_model is not None:
        card["models"].append({
            "name": "XGBoost",
            "type": "XGBClassifier",
            "accuracy": _metadata.get("xgb_accuracy", 0) if _metadata else 0,
        })

    return card


def get_prediction_distribution() -> dict:
    if not _prediction_log:
        return {"count": 0, "mean": 0, "std": 0, "histogram": [], "recent": []}

    scores = [p["risk_score"] for p in _prediction_log]
    arr = np.array(scores)

    # Histogram buckets
    buckets = [0] * 10
    for s in scores:
        idx = min(int(s / 10), 9)
        buckets[idx] += 1

    return {
        "count": len(scores),
        "mean": round(float(arr.mean()), 1),
        "std": round(float(arr.std()), 1),
        "min": round(float(arr.min()), 1),
        "max": round(float(arr.max()), 1),
        "histogram": [{"range": f"{i*10}-{(i+1)*10}", "count": c} for i, c in enumerate(buckets)],
        "recent": [{"risk_score": p["risk_score"], "case_id": p["case_id"], "ts": p["timestamp"]} for p in list(_prediction_log)[-10:]],
    }


def detect_anomaly(features: dict) -> dict:
    """Isolation Forest anomaly detection on transaction features."""
    from sklearn.ensemble import IsolationForest

    X = pd.DataFrame([[features.get(col, 0) for col in FEATURE_COLS]], columns=FEATURE_COLS)

    # Use a quick IsolationForest fitted on current feature distribution
    # In production, this would be pre-trained; here we use training stats for reference
    if _dataset_stats is None:
        return {"is_anomaly": False, "score": 0}

    # Simple z-score based anomaly (fast, no model needed)
    anomaly_score = 0
    flagged_features = []
    for col in FEATURE_COLS:
        if col not in _dataset_stats.get("feature_stats", {}):
            continue
        train_mean = _dataset_stats["feature_stats"][col]["mean"]
        train_std = _dataset_stats["feature_stats"][col]["std"]
        current_val = float(X.iloc[0][col])
        if train_std > 0:
            z = abs(current_val - train_mean) / train_std
            if z > 3.0:
                anomaly_score += z
                flagged_features.append({
                    "feature": col,
                    "label": FEATURE_NAMES_CN.get(col, col),
                    "z_score": round(z, 2),
                    "value": round(current_val, 4),
                })

    is_anomaly = anomaly_score > 5.0

    if is_anomaly:
        _anomaly_log.append({
            "timestamp": time.time(),
            "score": round(anomaly_score, 2),
            "features": flagged_features,
        })

    return {
        "is_anomaly": is_anomaly,
        "score": round(anomaly_score, 2),
        "flagged_features": flagged_features,
        "threshold": 5.0,
    }


def detect_mule_network(transactions: list) -> dict:
    """
    Graph-based mule account detection using NetworkX.
    Input: list of transactions with from_account, to_account, amount.
    Output: flagged clusters and suspicious accounts.
    """
    try:
        import networkx as nx
    except ImportError:
        return {"error": "NetworkX not installed", "clusters": []}

    G = nx.DiGraph()

    for tx in transactions:
        src = tx.get("from_account", "")
        dst = tx.get("to_account", "")
        amt = tx.get("amount", 0)
        if src and dst:
            if G.has_edge(src, dst):
                G[src][dst]["weight"] += amt
                G[src][dst]["count"] += 1
            else:
                G.add_edge(src, dst, weight=amt, count=1)

    if len(G.nodes) == 0:
        return {"total_accounts": 0, "total_edges": 0, "clusters": [], "suspicious_accounts": []}

    # Community detection on undirected version
    G_undirected = G.to_undirected()
    try:
        from networkx.algorithms.community import louvain_communities
        communities = louvain_communities(G_undirected, seed=42)
    except Exception:
        communities = list(nx.connected_components(G_undirected))

    clusters = []
    suspicious = []

    for i, community in enumerate(communities):
        if len(community) < 3:
            continue

        # Calculate cluster metrics
        subgraph = G.subgraph(community)
        total_flow = sum(d["weight"] for _, _, d in subgraph.edges(data=True))
        total_txns = sum(d["count"] for _, _, d in subgraph.edges(data=True))

        # Degree centrality to find key nodes
        centrality = nx.degree_centrality(subgraph)
        sorted_centrality = sorted(centrality.items(), key=lambda x: x[1], reverse=True)

        # Flag if cluster has high fan-out (many accounts receiving from one source)
        fan_out = {}
        for node in community:
            out_degree = subgraph.out_degree(node, weight="count") if node in subgraph else 0
            fan_out[node] = out_degree

        max_fan_out = max(fan_out.values()) if fan_out else 0

        is_suspicious = (
            len(community) >= 4 and
            total_flow > 100000 and
            max_fan_out >= 3
        )

        cluster_info = {
            "cluster_id": i + 1,
            "size": len(community),
            "accounts": list(community),
            "total_flow": round(total_flow, 2),
            "total_transactions": total_txns,
            "top_nodes": [{"account": n, "centrality": round(c, 3)} for n, c in sorted_centrality[:3]],
            "max_fan_out": max_fan_out,
            "risk_level": "High" if is_suspicious else "Medium" if len(community) >= 3 else "Low",
        }
        clusters.append(cluster_info)

        if is_suspicious:
            suspicious.extend([n for n, _ in sorted_centrality[:2]])

    clusters.sort(key=lambda x: x["size"], reverse=True)

    return {
        "total_accounts": len(G.nodes),
        "total_edges": len(G.edges),
        "clusters": clusters,
        "suspicious_accounts": list(set(suspicious)),
        "graph_density": round(nx.density(G), 4) if len(G.nodes) > 1 else 0,
    }


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = np.radians(lat2 - lat1)
    dlng = np.radians(lng2 - lng1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlng/2)**2
    return R * 2 * np.arcsin(np.sqrt(a))


def bounding_box_filter(lat, lng, candidates, max_km=50):
    """
    Pre-filter candidates using a rectangular bounding box before haversine.

    Approximates 1 degree latitude ≈ 111 km, adjusts longitude by cos(latitude).
    Returns only candidates within the box (superset of true radius filter).
    """
    dlat = max_km / 111.0
    dlng = max_km / (111.0 * max(np.cos(np.radians(lat)), 0.01))
    min_lat, max_lat = lat - dlat, lat + dlat
    min_lng, max_lng = lng - dlng, lng + dlng
    return [
        c for c in candidates
        if min_lat <= c["latitude"] <= max_lat and min_lng <= c["longitude"] <= max_lng
    ]


def haversine_filtered(lat, lng, candidates, max_km=50, limit=8):
    """
    Combined bounding box pre-filter + haversine for scalable distance queries.
    """
    filtered = bounding_box_filter(lat, lng, candidates, max_km)
    results = []
    for c in filtered:
        d = haversine(lat, lng, c["latitude"], c["longitude"])
        if d <= max_km:
            results.append((d, c))
    results.sort(key=lambda x: x[0])
    return results[:limit]
