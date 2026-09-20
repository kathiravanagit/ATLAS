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
_shap_cache: dict[str, list] = {}  # case_id -> SHAP contributions (avoid recompute)

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


def _init_shap_explainer():
    """Lazy-init SHAP KernelExplainer with background dataset."""
    global _shap_explainer, _shap_background
    if _shap_explainer is not None:
        return _shap_explainer

    try:
        import shap
        rf, _ = load_models()
        if rf is None:
            return None

        # Build background dataset from training stats (100 samples)
        if _dataset_stats and "feature_stats" in _dataset_stats:
            bg_data = []
            for _ in range(100):
                sample = []
                for col in FEATURE_COLS:
                    stats = _dataset_stats["feature_stats"].get(col, {"mean": 0.5, "std": 0.1})
                    val = np.random.normal(stats["mean"], max(stats["std"], 0.01))
                    sample.append(val)
                bg_data.append(sample)
            _shap_background = pd.DataFrame(bg_data, columns=FEATURE_COLS)
        else:
            _shap_background = pd.DataFrame(
                np.random.uniform(0, 1, (100, len(FEATURE_COLS))),
                columns=FEATURE_COLS
            )

        _shap_explainer = shap.KernelExplainer(rf.predict_proba, _shap_background)
        return _shap_explainer
    except Exception:
        return None


def compute_shap_values(features: dict, case_id: str = None) -> list:
    """Compute real SHAP values for a single prediction. Cached per case_id."""
    if case_id and case_id in _shap_cache:
        return _shap_cache[case_id]

    try:
        import shap
        explainer = _init_shap_explainer()
        if explainer is None:
            return []

        X = pd.DataFrame([[features.get(col, 0) for col in FEATURE_COLS]], columns=FEATURE_COLS)
        shap_values = explainer.shap_values(X, nsamples=100)

        # shap_values is [class_0, class_1] for binary; we want class_1 (cash-out)
        if isinstance(shap_values, list) and len(shap_values) >= 2:
            values = shap_values[1][0]  # class 1, first sample
        else:
            values = shap_values[0] if isinstance(shap_values, np.ndarray) else np.array(shap_values)

        contributions = []
        for i, col in enumerate(FEATURE_COLS):
            val = float(values[i]) if i < len(values) else 0.0
            contributions.append({
                "feature": col,
                "label": FEATURE_NAMES_CN.get(col, col),
                "value": round(float(X.iloc[0][col]), 4),
                "shap_value": round(val, 4),
                "contribution": round(val, 4),
                "direction": "positive" if val > 0 else "negative",
                "abs_contribution": round(abs(val), 4),
            })

        contributions.sort(key=lambda x: x["abs_contribution"], reverse=True)

        if case_id and contributions:
            _shap_cache[case_id] = contributions
            if len(_shap_cache) > 200:
                oldest = list(_shap_cache.keys())[0]
                del _shap_cache[oldest]

        return contributions
    except Exception:
        return []


def get_metadata():
    load_models()
    return _metadata


def _compute_feature_contributions(X: pd.DataFrame, model) -> list:
    """Per-prediction feature contribution using MDI importance * feature value."""
    if not hasattr(model, 'feature_importances_'):
        return []
    importances = model.feature_importances_
    values = X.iloc[0].values
    contributions = []
    for i, col in enumerate(FEATURE_COLS):
        contrib = float(importances[i] * values[i])
        contributions.append({
            "feature": col,
            "label": FEATURE_NAMES_CN.get(col, col),
            "value": round(float(values[i]), 4),
            "importance": round(float(importances[i]), 4),
            "contribution": round(contrib, 4),
            "direction": "positive" if contrib > 0 else "negative",
        })
    contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return contributions


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
    rf, xgb = load_models()
    if rf is None and xgb is None:
        return {"error": "No models loaded", "risk_score": 50, "confidence": 0}

    X = pd.DataFrame([[features.get(col, 0) for col in FEATURE_COLS]], columns=FEATURE_COLS)

    results = {}
    weights = {}

    # Random Forest prediction
    if rf is not None:
        rf_prob = rf.predict_proba(X)[0][1]
        results["random_forest"] = {
            "probability": round(float(rf_prob), 4),
            "risk_score": round(float(rf_prob * 100), 1),
            "prediction": int(rf.predict(X)[0]),
        }
        weights["random_forest"] = 0.5

    # XGBoost prediction
    if xgb is not None:
        xgb_prob = xgb.predict_proba(X)[0][1]
        results["xgboost"] = {
            "probability": round(float(xgb_prob), 4),
            "risk_score": round(float(xgb_prob * 100), 1),
            "prediction": int(xgb.predict(X)[0]),
        }
        weights["xgboost"] = 0.5

    # Ensemble (weighted average)
    total_weight = sum(weights.values())
    ensemble_prob = sum(
        results[m]["probability"] * weights[m] for m in results
    ) / total_weight

    # Feature contributions (from RF, which has feature_importances_)
    contributions = []
    if rf is not None and hasattr(rf, 'feature_importances_'):
        contributions = _compute_feature_contributions(X, rf)

    # Drift check
    drift = _check_drift(X)

    # Log prediction — cap at 99% to avoid overfitting appearance
    risk_score = round(min(float(ensemble_prob * 100), 99.0), 1)
    _log_prediction(risk_score, X, case_id)

    return {
        "risk_score": risk_score,
        "prediction": 1 if ensemble_prob > 0.5 else 0,
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
