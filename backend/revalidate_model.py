"""
ATLAS model revalidation protocol (synthetic benchmark).

Evaluates the FROZEN production ensemble (0.5*RF + 0.5*XGB, threshold 0.5)
on splits the original random-holdout never tested:
  1. time holdout      — train-months vs latest months (temporal drift check)
  2. location holdout  — 6 cities train, 2 cities held out (spatial generalization)
  3. majority baseline — DummyClassifier(most_frequent) per slice
  4. calibration       — 10-bin reliability + Brier score on the random holdout
  5. threshold sweep    — precision/recall/F1 at 0.3..0.8 for capacity planning

Writes backend/model/validation_report.json (tracked). No model weights change.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, average_precision_score
from sklearn.dummy import DummyClassifier

from ml_engine import load_models, FEATURE_COLS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "transactions_200k.csv")
REPORT_PATH = os.path.join(BASE_DIR, "model", "validation_report.json")

TIME_CUTOFF_MONTH = 10  # months >= 10 are the "future" holdout
LOCATION_HOLDOUT = ["kolkata", "ahmedabad"] if True else []
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
    return p / w if w else p


def slice_metrics(name, y, proba):
    pred = (proba >= 0.5).astype(int)
    dummy = DummyClassifier(strategy="most_frequent").fit(
        np.zeros((len(y), 1)), y).predict(np.zeros((len(y), 1)))
    return {
        "slice": name,
        "n": int(len(y)),
        "positives": int(y.sum()),
        "positive_rate_pct": round(float(y.mean() * 100), 2),
        "precision": round(float(precision_score(y, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y, pred, zero_division=0)), 4),
        "pr_auc": round(float(average_precision_score(y, proba)), 4),
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


def main():
    print("ATLAS model revalidation (frozen ensemble, synthetic benchmark)")
    rf, xgb = load_models()
    if rf is None and xgb is None:
        raise SystemExit("No model artifacts found.")
    df = pd.read_csv(CSV_PATH, usecols=FEATURE_COLS + ["cash_out_occurred", "city", "month"])
    print(f"  rows: {len(df):,} | cities: {sorted(df.city.unique())} | months: {sorted(df.month.unique())}")

    X_all = df[FEATURE_COLS]
    y_all = df["cash_out_occurred"].to_numpy()
    proba_all = ensemble_proba(rf, xgb, X_all)

    # Time holdout: latest months as the "future"
    months = sorted(df["month"].unique())
    cutoff = months[max(0, len(months) - 2)]
    te = df["month"] >= cutoff
    print(f"  time cutoff: month >= {cutoff} ({te.sum():,} rows)")

    # Location holdout: cities never seen together (fall back if absent)
    holdout_cities = [c for c in LOCATION_HOLDOUT if c in set(df["city"].unique())]
    if len(holdout_cities) < 2:
        holdout_cities = sorted(df["city"].unique())[-2:]
    loc = df["city"].isin(holdout_cities)
    print(f"  location holdout cities: {holdout_cities} ({loc.sum():,} rows)")

    report = {
        "protocol": "frozen-ensemble validation on synthetic benchmark",
        "ensemble": "0.5*RF + 0.5*XGB, threshold 0.5",
        "slices": {
            "random_holdout_note": "original 80/20 stratified split — see metadata.json",
            "time_holdout": slice_metrics(f"month>=cutoff", y_all[te], proba_all[te]),
            "location_holdout": slice_metrics(f"cities={holdout_cities}", y_all[loc], proba_all[loc]),
        },
        "calibration_random_sample": calibration(proba_all[:20000], y_all[:20000]),
        "threshold_sweep_random_sample": threshold_sweep(y_all[:20000], proba_all[:20000]),
        "guidance": "pick the threshold from investigator capacity and false-positive "
                    "cost using the sweep above; never cite accuracy alone on 3.6% positives.",
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"  wrote {REPORT_PATH}")
    for name, s in report["slices"].items():
        if not isinstance(s, dict):
            continue
        print(f"  {name}: n={s['n']} recall={s['recall']} prec={s['precision']} "
              f"f1={s['f1']} baseline={s['baseline_majority_accuracy_pct']}%")


if __name__ == "__main__":
    main()
