"""Revalidate only exclusions established before fitting and bound to artifacts.

Legacy frozen artifacts without provenance cannot establish unseen group/city/time
performance. They are reported unavailable, never scored on train-inclusive slices.
The old first-20,000 ordered prefix was not a random sample (rings came first).
No training or model-weight changes are performed by this script.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score
from train_model import (
    establish_splits, validate_split_disjointness, file_hash,
    future_outcome_metrics, precision_recall_metrics,
)

from ml_engine import load_models, FEATURE_COLS, RF_PATH, XGB_PATH, METADATA_PATH

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "transactions_200k.csv")
REPORT_PATH = os.path.join(BASE_DIR, "model", "validation_report.json")


THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]


def ensemble_proba(rf, xgb, X):
    p = np.zeros(len(X))
    w = 0.0
    if rf is not None:
        p += rf.predict_proba(X)[:, 1]
        w += 1.0
    if xgb is not None:
        p += xgb.predict_proba(X)[:, 1]
        w += 1.0
    if not w:
        raise ValueError("MODEL_UNAVAILABLE: no fitted estimators")
    return p / w


def slice_metrics(name, y, proba, majority_class=0):
    pred = (proba >= 0.5).astype(int)
    dummy = np.full(len(y), majority_class)  # selected from training, never slice labels
    return {
        "slice": name,
        "n": int(len(y)),
        "positives": int(y.sum()),
        "positive_rate_pct": round(float(y.mean() * 100), 2),
        "precision": round(float(precision_score(y, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y, pred, zero_division=0)), 4),
        **precision_recall_metrics(y, proba),
        "baseline_majority_accuracy_pct": round(float((dummy == y).mean() * 100), 2),
    }


def calibration(proba, y, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (proba > lo) & (proba <= hi) if lo > 0 else (proba <= hi)
        if mask.sum() == 0:
            continue
        out.append({
            "bin": [round(float(lo), 2), round(float(hi), 2)],
            "n": int(mask.sum()),
            "mean_predicted": round(float(proba[mask].mean()), 4),
            "empirical_rate": round(float(y[mask].mean()), 4),
        })
    brier = float(np.mean((proba - y) ** 2))
    return {"bins": out, "brier_score": round(brier, 4),
            "note": "scores are ranking scores, not calibrated probabilities"}


def baseline_comparison(df, y, proba, seed=42):
    """Answer: is ATLAS better than 'send police to the nearest ATM' / 'highest historical crime'?

    Ranking strategies share the ensemble alert budget; the no-alert baseline
    is explicitly not a matched-budget ranking. Trapezoidal PR-AUC and average
    precision are distinct, budget-free summaries.
    """
    k = int((proba >= 0.5).sum())
    rng = np.random.default_rng(seed)

    strategies = {
        "no_alert": np.zeros(len(y)),                             # always "no cash-out"
        "random_ranking": rng.random(len(y)),                     # random dispatch
        "nearest_atm": -df["distance_from_victim_km"].to_numpy(),  # closest ATM to victim
        "historical_density": df["historical_crime_density"].to_numpy(),  # highest-crime ATM
        "atlas_ensemble": proba,                                  # the model
    }
    out = {"alert_budget_k": k,
           "note": "precision/recall measured at the same alert budget k as the "
                   "production ensemble (threshold 0.5); trapezoidal PR-AUC and "
                   "non-interpolated average precision are distinct and budget-free"}
    prevalence = float(y.mean())
    for name, score in strategies.items():
        if name == "no_alert":
            # degenerate scorer: flags nothing -> recall 0, accuracy = 1 - prevalence
            out[name] = {
                **precision_recall_metrics(y, score),
                "precision_at_k": None, "recall_at_k": None, "f1_at_k": None,
                "note": "No-alert baseline; not a same-budget ranking strategy",
                "accuracy_pct": round((1 - prevalence) * 100, 2),
            }
            continue
        order = np.argsort(-score, kind="stable")[:k]
        pred = np.zeros(len(y), dtype=int)
        pred[order] = 1
        tp = int(((pred == 1) & (y == 1)).sum())
        precision = tp / k if k else 0.0
        recall = tp / int(y.sum()) if y.sum() else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        out[name] = {
            **precision_recall_metrics(y, score),
            "precision_at_k": round(float(precision), 4),
            "recall_at_k": round(float(recall), 4),
            "f1_at_k": round(float(f1), 4),
        }
    return out


def threshold_sweep(y, proba):
    rows = []
    for t in THRESHOLDS:
        pred = (proba >= t).astype(int)
        rows.append({
            "threshold": t,
            "precision": round(float(precision_score(y, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y, pred, zero_division=0)), 4),
            "f1": round(float(f1_score(y, pred, zero_division=0)), 4),
            "flagged": int(pred.sum()),
        })
    return rows


def hit_at_k_metrics(df, splits, rf, xgb, ks=(1, 3, 5)):
    """Synthetic ATM-retrieval check mirroring the heatmap ranking.

    Per holdout city-slice, rank that slice's ATMs by mean ensemble
    probability over the slice's rows at each ATM; truth is the slice ATM
    with the most actual cash-outs. Synthetic only, small-n city slices —
    not real-world next-ATM accuracy.
    """
    if not {"atm_id", "city", "cash_out_occurred"}.issubset(df.columns):
        return {"status": "unavailable",
                "reason": "Retrieval needs per-row atm_id, city and cash-out labels"}
    units = []
    for name in ("group_holdout", "time_holdout", "location_holdout"):
        part = df.iloc[splits[name]]
        if part.empty:
            continue
        for city_name, city_part in part.groupby("city"):
            units.append((f"{name}:{city_name}", city_part))
    hits = {k: 0 for k in ks}
    evaluated = 0
    details = []
    for uname, upart in units:
        if upart["atm_id"].nunique() < 2 or int(upart["cash_out_occurred"].sum()) == 0:
            continue
        proba = ensemble_proba(rf, xgb, upart[FEATURE_COLS])
        ranked = (upart.assign(_proba=proba).groupby("atm_id")["_proba"]
                  .mean().sort_values(ascending=False))
        truth = (upart.loc[upart["cash_out_occurred"] == 1]
                 .groupby("atm_id").size().sort_values(ascending=False))
        top_actual = truth.index[0]
        rank_of_truth = list(ranked.index).index(top_actual) + 1
        evaluated += 1
        for k in ks:
            if rank_of_truth <= k:
                hits[k] += 1
        details.append({"unit": uname, "n_atms": int(upart["atm_id"].nunique()),
                        "cashouts": int(upart["cash_out_occurred"].sum()),
                        "truth_atm": str(top_actual), "truth_rank": rank_of_truth})
    return {
        "status": "available_synthetic_only" if evaluated else "unavailable",
        "method": "per holdout city-slice, rank ATMs by mean ensemble probability over slice rows; truth = slice ATM with most actual cash-outs",
        "n_units": evaluated,
        "hits": {f"top_{k}": f"{hits[k]}/{evaluated}" for k in ks},
        "hit_rate": {f"top_{k}": (round(hits[k] / evaluated, 4) if evaluated else None) for k in ks},
        "units": details,
        "note": "synthetic ATM-retrieval check mirroring the heatmap ranking; small-n city slices, not real-world next-ATM accuracy",
    }


def unavailable_report(reason):
    unavailable = {"status": "unavailable", "reason": reason}
    return {
        "protocol": "provenance-required frozen synthetic classification validation",
        "status": "unavailable",
        "slices": {name: dict(unavailable) for name in
                   ("group_holdout", "time_holdout", "location_holdout")},
        "baseline_comparison": dict(unavailable),
        "calibration": dict(unavailable), "threshold_sweep": dict(unavailable),
        "synthetic_hit_at_k": dict(unavailable),
        "previous_prefix_diagnostic": {
            "status": "withdrawn",
            "selection": "first 20000 rows in file order, NOT a random sample",
            "reason": "Training overlap unknown; ordered fraud-enriched prefix cannot support clean holdout superiority or calibration claims",
        },
        "future_outcome_metrics": future_outcome_metrics(),
        "guidance": "Explicitly regenerate and retrain with saved pre-fit exclusions to obtain valid synthetic holdout metrics. No real-world next-ATM/time claims are supported.",
    }


def validate_provenance(df, metadata, artifact_paths=None):
    provenance = metadata.get("split_provenance")
    if not provenance:
        raise ValueError("Frozen artifacts lack split provenance; unseen group/city/time and clean baseline superiority are unavailable")
    splits, expected = establish_splits(
        df, seed=provenance["seed"], holdout_cities=provenance["holdout_cities"],
        time_cutoff=provenance["time_cutoff_month"],
    )
    validate_split_disjointness(
        df, splits, provenance["holdout_cities"], provenance["time_cutoff_month"],
    )
    for key, value in expected.items():
        if provenance.get(key) != value:
            raise ValueError(f"Split provenance mismatch: {key}")
    paths = artifact_paths if artifact_paths is not None else {
        "random_forest": RF_PATH, "xgboost": XGB_PATH,
    }
    actual = {name: file_hash(path) for name, path in paths.items() if os.path.exists(path)}
    if not actual or actual != provenance.get("artifact_sha256"):
        raise ValueError("Model artifacts do not match pre-fit split provenance")
    return splits


def build_validation_report(df, metadata, rf, xgb, artifact_paths=None):
    try:
        splits = validate_provenance(df, metadata, artifact_paths)
        expected_models = set(metadata["split_provenance"]["artifact_sha256"])
        loaded_models = {name for name, model in (("random_forest", rf), ("xgboost", xgb)) if model is not None}
        if expected_models != loaded_models:
            raise ValueError("Loaded estimator set does not match provenance")
    except (ValueError, KeyError, TypeError, OSError) as exc:
        return unavailable_report(str(exc))
    report = {
        "protocol": metadata["split_provenance"]["protocol"],
        "status": "available_synthetic_only",
        "split_provenance": metadata["split_provenance"],
        "ensemble": "mean of available fitted estimator probabilities; threshold >=0.5",
        "slices": {}, "baseline_comparison": {}, "calibration": {}, "threshold_sweep": {},
        "future_outcome_metrics": future_outcome_metrics(),
        "limitations": "Synthetic row-level classification; month ordering is not observed future time. Threshold sweeps are descriptive, not an independent threshold-selection test.",
    }
    majority = int(df.iloc[splits["train"]].cash_out_occurred.mode().iloc[0])
    for name in ("group_holdout", "time_holdout", "location_holdout"):
        part = df.iloc[splits[name]]
        if part.empty or part.cash_out_occurred.nunique() < 2:
            report["slices"][name] = {"status": "unavailable", "reason": "Slice needs both target classes"}
            continue
        y = part.cash_out_occurred.to_numpy()
        proba = ensemble_proba(rf, xgb, part[FEATURE_COLS])
        report["slices"][name] = {"status": "available_synthetic_only", **slice_metrics(name, y, proba, majority)}
        report["baseline_comparison"][name] = baseline_comparison(part, y, proba)
        report["calibration"][name] = calibration(proba, y)
        report["threshold_sweep"][name] = threshold_sweep(y, proba)
    report["synthetic_hit_at_k"] = hit_at_k_metrics(df, splits, rf, xgb)
    return report


def main():
    with open(METADATA_PATH) as handle:
        metadata = json.load(handle)
    if not metadata.get("split_provenance"):
        report = unavailable_report("Frozen artifacts lack split provenance; explicit retraining required for valid holdout evaluation")
    else:
        df = pd.read_csv(CSV_PATH)
        rf, xgb = load_models()
        report = build_validation_report(df, metadata, rf, xgb)
    with open(REPORT_PATH, "w") as handle:
        json.dump(report, handle, indent=2)
    print(f"Validation status: {report['status']}; wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()
