"""
ATLAS ML Model Training v6
Ensemble: Random Forest + XGBoost, with pre-fit group/city/time exclusions.
Saves synthetic classification metrics, global MDI importance, empirical SHAP
background, split IDs/content hashes, and model artifact hashes. Requires data
regenerated with explicit ring groups and observable time-window semantics.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
import hashlib
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score,
    precision_score, recall_score, f1_score, roc_curve, auc,
    precision_recall_curve, average_precision_score
)
import joblib
import json
import os
from datetime import datetime

SPLIT_PROTOCOL = "group-city-time-v1"
FEATURE_PROTOCOL = "observable-evening-window-v1"
HOLDOUT_CITIES = ["kolkata", "ahmedabad"]
TIME_CUTOFF_MONTH = 11


def frame_hash(df):
    """Bind provenance to ordered contents, not just a filename or row count."""
    return hashlib.sha256(df.to_csv(index=False, float_format="%.17g").encode()).hexdigest()


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_split_disjointness(df, splits, holdout_cities, time_cutoff):
    """Check actual row/group partitions; purged rows may share held-out groups."""
    evaluated = ("train", "group_holdout", "location_holdout", "time_holdout")
    if set(splits) != set(evaluated) | {"purged"}:
        raise ValueError("Invalid partition names")
    positions = []
    groups = {}
    for name, indices in splits.items():
        indices = np.asarray(indices)
        if (indices.ndim != 1 or not np.issubdtype(indices.dtype, np.integer)
                or (indices < 0).any() or (indices >= len(df)).any()):
            raise ValueError(f"Invalid row positions in partition: {name}")
        positions.extend(indices.tolist())
        groups[name] = set(df.iloc[indices].group_id.astype(str))
    if len(positions) != len(set(positions)):
        raise ValueError("Row partitions overlap")
    if set(positions) != set(range(len(df))):
        raise ValueError("Row partitions do not cover the dataset")
    for i, name in enumerate(evaluated):
        for other in evaluated[i + 1:]:
            if groups[name] & groups[other]:
                raise ValueError(f"Group partitions overlap: {name}/{other}")
    for name in ("train", "group_holdout"):
        if groups[name] & groups["purged"]:
            raise ValueError(f"Purged groups leak into partition: {name}")
        part = df.iloc[splits[name]]
        if part.city.isin(holdout_cities).any() or (part.month >= time_cutoff).any():
            raise ValueError(f"City/time exclusions leak into partition: {name}")
    if not df.iloc[splits["location_holdout"]].city.isin(holdout_cities).all():
        raise ValueError("Location partition contains non-held-out cities")
    if not (df.iloc[splits["time_holdout"]].month >= time_cutoff).all():
        raise ValueError("Time partition contains earlier months")


def establish_splits(df, seed=42, holdout_cities=None, time_cutoff=TIME_CUTOFF_MONTH):
    """Exclude city/future groups BEFORE fitting; purge overlapping earlier rows.

    City has precedence over time. Groups touching either excluded slice never
    enter training or the group holdout, even if they also have earlier rows.
    Month is synthetic ordering within one year, not observed future outcomes.
    """
    required = {"transaction_id", "group_id", "city", "month", "feature_protocol", "hour", "time_window_match"}
    if not required.issubset(df.columns):
        raise ValueError("Regenerate data: explicit group IDs and observable feature protocol required")
    if df[list(required)].isna().any().any() or df.transaction_id.astype(str).duplicated().any():
        raise ValueError("Split keys must be non-null and transaction IDs unique")
    if set(df.feature_protocol) != {FEATURE_PROTOCOL}:
        raise ValueError("Regenerate data: incompatible/oracle-conditioned feature protocol")
    if not (df.time_window_match == df.hour.between(17, 22).astype(float)).all():
        raise ValueError("Regenerate data: time-window values do not match observable serving semantics")
    cities = sorted(HOLDOUT_CITIES if holdout_cities is None else holdout_cities)
    city_mask = df.city.isin(cities)
    city_groups = set(df.loc[city_mask, "group_id"])
    time_mask = (df.month >= time_cutoff) & ~df.group_id.isin(city_groups)
    excluded_groups = city_groups | set(df.loc[time_mask, "group_id"])
    eligible = np.flatnonzero(~df.group_id.isin(excluded_groups).to_numpy())
    if df.iloc[eligible].group_id.nunique() < 2:
        raise ValueError("Insufficient independent training/holdout groups")
    train_local, test_local = next(GroupShuffleSplit(
        n_splits=1, test_size=0.2, random_state=seed
    ).split(df.iloc[eligible], groups=df.iloc[eligible].group_id))
    splits = {
        "train": eligible[train_local],
        "group_holdout": eligible[test_local],
        "location_holdout": np.flatnonzero(city_mask.to_numpy()),
        "time_holdout": np.flatnonzero(time_mask.to_numpy()),
    }
    used = np.concatenate(list(splits.values()))
    splits["purged"] = np.setdiff1d(np.arange(len(df)), used)
    validate_split_disjointness(df, splits, cities, time_cutoff)
    provenance = {
        "protocol": SPLIT_PROTOCOL, "seed": seed, "holdout_cities": cities,
        "time_cutoff_month": time_cutoff, "group_column": "group_id",
        "feature_protocol": FEATURE_PROTOCOL, "dataset_sha256": frame_hash(df),
        "partitions": {},
    }
    for name, indices in splits.items():
        ids = df.iloc[indices].transaction_id.astype(str).tolist()
        groups = sorted(df.iloc[indices].group_id.astype(str).unique().tolist())
        provenance["partitions"][name] = {
            "row_ids": ids, "group_ids": groups,
            "row_ids_sha256": hashlib.sha256(json.dumps(ids).encode()).hexdigest(),
        }
    return splits, provenance


def precision_recall_metrics(y, scores):
    """Keep trapezoidal PR-AUC distinct from non-interpolated average precision."""
    precision, recall, _ = precision_recall_curve(y, scores)
    return {
        "pr_auc": round(float(auc(recall, precision)), 4),
        "average_precision": round(float(average_precision_score(y, scores)), 4),
        "pr_auc_method": "trapezoidal_precision_recall_curve",
        "average_precision_method": "sklearn.average_precision_score",
    }


def mean_shift_diagnostics(X_train, X_test):
    """Absolute standardized mean shift, NOT population stability index (PSI).

    Constant training features cannot be standardized: a changed mean is flagged
    but the score is unavailable rather than silently reported as zero drift.
    """
    diagnostics = {}
    for col in X_train.columns:
        train_mean = float(X_train[col].mean())
        test_mean = float(X_test[col].mean())
        train_std = float(X_train[col].std())
        score = abs(test_mean - train_mean) / train_std if train_std > 0 else None
        diagnostics[col] = {
            "train_mean": round(train_mean, 4), "test_mean": round(test_mean, 4),
            "mean_shift_z": round(score, 4) if score is not None else None,
            "metric_method": "absolute_standardized_mean_shift_not_psi",
            "drifted": bool(score > 0.2) if score is not None else train_mean != test_mean,
        }
        if score is None:
            diagnostics[col]["reason"] = "Training feature has no positive standard deviation"
    return diagnostics


def future_outcome_metrics():
    return {
        "status": "unavailable",
        "next_atm_top1": None, "next_atm_top3": None, "next_atm_top5": None,
        "next_cashout_time_mae": None,
        "reason": "Requires case-grouped candidate ATMs, prediction timestamps, and observed future ATM/time outcomes; row classification and ROC curves cannot supply these metrics.",
    }

FEATURE_COLS = [
    "distance_from_victim_km", "historical_crime_density", "time_window_match",
    "atm_type_score", "suspect_distance_km", "recent_withdrawal_freq",
    "amount", "num_mule_accounts", "hour", "day_of_week",
    "transaction_velocity", "proximity_score", "density_score",
    "suspect_proximity", "amount_factor"
]


def load_expanded_dataset(csv_path="data/transactions_200k.csv"):
    """Load the expanded 200k transaction dataset."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}. Run generate_data.py first.")
    df = pd.read_csv(csv_path)
    print(f"  Loaded {len(df):,} transactions from {csv_path}")
    return df


def train_model():
    print("=" * 60)
    print("ATLAS ML MODEL TRAINING v6 (Grouped Synthetic Dataset)")
    print("Ensemble: Random Forest + XGBoost")
    print("=" * 60)

    # ── Load expanded dataset ──
    print("\n[1/8] Loading expanded dataset...")
    df = load_expanded_dataset()
    pos = df["cash_out_occurred"].sum()
    neg = len(df) - pos
    print(f"  Total samples: {len(df):,}")
    print(f"  Cash-out (positive): {pos:,} ({pos/len(df)*100:.2f}%)")
    print(f"  No cash-out (negative): {neg:,} ({neg/len(df)*100:.2f}%)")

    X = df[FEATURE_COLS]
    y = df["cash_out_occurred"]

    # All evaluated exclusions are fixed before either estimator sees data.
    print("\n[2/8] Establishing group/city/time exclusions...")
    splits, provenance = establish_splits(df)
    X_train, X_test = X.iloc[splits["train"]], X.iloc[splits["group_holdout"]]
    y_train, y_test = y.iloc[splits["train"]], y.iloc[splits["group_holdout"]]
    if y_train.nunique() != 2 or y_test.nunique() != 2:
        raise ValueError("Training and group holdout must contain both target classes")
    print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")

    # ── Random Forest ──
    print("\n[3/8] Training Random Forest (200 estimators)...")
    rf = RandomForestClassifier(
        n_estimators=200, max_depth=12, min_samples_split=8,
        min_samples_leaf=4, class_weight="balanced",
        random_state=42, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    rf_proba = rf.predict_proba(X_test)[:, 1]
    rf_pred = (rf_proba >= 0.5).astype(int)
    rf_acc = accuracy_score(y_test, rf_pred)
    # Row-wise CV would mix related groups and excluded cities/months.
    print(f"  RF Accuracy: {rf_acc*100:.1f}%")

    # ── XGBoost ──
    print("\n[4/8] Training XGBoost...")
    has_xgb = False
    try:
        from xgboost import XGBClassifier
        xgb = XGBClassifier(
            n_estimators=200, max_depth=8, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8, random_state=42,
            eval_metric="logloss", n_jobs=-1,
        )
        xgb.fit(X_train, y_train)
        xgb_proba = xgb.predict_proba(X_test)[:, 1]
        xgb_pred = (xgb_proba >= 0.5).astype(int)
        xgb_acc = accuracy_score(y_test, xgb_pred)
        print(f"  XGB Accuracy: {xgb_acc*100:.1f}%")
        has_xgb = True
    except ImportError:
        print("  XGBoost not installed, using RF only")
        xgb_acc = 0

    # ── Ensemble evaluation ──
    print("\n[5/8] Evaluating ensemble...")
    if has_xgb:
        ensemble_proba = 0.5 * rf_proba + 0.5 * xgb_proba
        ensemble_pred = (ensemble_proba >= 0.5).astype(int)
        ensemble_acc = accuracy_score(y_test, ensemble_pred)
    else:
        ensemble_proba = rf_proba
        ensemble_pred = rf_pred
        ensemble_acc = rf_acc

    # Compute all metrics
    precision = precision_score(y_test, ensemble_pred)
    recall = recall_score(y_test, ensemble_pred)
    f1 = f1_score(y_test, ensemble_pred)
    cm = confusion_matrix(y_test, ensemble_pred)
    tn, fp, fn, tp = cm.ravel()

    # ROC curve
    fpr, tpr, roc_thresholds = roc_curve(y_test, ensemble_proba)
    roc_auc_val = auc(fpr, tpr)

    # Precision-recall curve
    prec_curve, rec_curve, pr_thresholds = precision_recall_curve(y_test, ensemble_proba)
    pr_metrics = precision_recall_metrics(y_test, ensemble_proba)
    pr_auc_val = pr_metrics["pr_auc"]

    print(f"  Ensemble Accuracy:  {ensemble_acc*100:.1f}%")
    print(f"  Ensemble Precision: {precision*100:.1f}%")
    print(f"  Ensemble Recall:    {recall*100:.1f}%")
    print(f"  Ensemble F1:        {f1*100:.1f}%")
    print(f"  ROC AUC:            {roc_auc_val:.4f}")
    print(f"  PR AUC (trapezoid): {pr_auc_val:.4f}")
    print(f"  Average precision:  {pr_metrics['average_precision']:.4f}")
    print(f"  Confusion Matrix: TP={tp} FP={fp} FN={fn} TN={tn}")

    # ── Feature importance ──
    print("\n[6/8] Computing feature importance...")
    importance = pd.DataFrame({
        "feature": FEATURE_COLS,
        "rf_importance": rf.feature_importances_,
    })
    if has_xgb:
        importance["xgb_importance"] = xgb.feature_importances_
        importance["ensemble_importance"] = (
            0.5 * importance["rf_importance"] + 0.5 * importance["xgb_importance"]
        )
    else:
        importance["ensemble_importance"] = importance["rf_importance"]
    importance = importance.sort_values("ensemble_importance", ascending=False)

    print("  Top features:")
    for _, row in importance.head(8).iterrows():
        bar = "#" * int(row["ensemble_importance"] * 40)
        print(f"    {row['feature']:30s} {row['ensemble_importance']:.3f} {bar}")

    # ── Classification report ──
    report = classification_report(y_test, ensemble_pred, target_names=["No Cash-Out", "Cash-Out"], output_dict=True)

    # ── Drift metrics (baseline from training) ──
    print("\n[7/8] Computing drift metrics...")
    drift = mean_shift_diagnostics(X_train, X_test)
    n_drifted = sum(1 for v in drift.values() if v["drifted"])
    print(f"  Mean-shift heuristic flags (not PSI): {n_drifted}/{len(FEATURE_COLS)}")

    # ── Save models and metadata ──
    print("\n[8/8] Saving models and metrics...")
    os.makedirs("model", exist_ok=True)
    joblib.dump(rf, "model/cashout_predictor.pkl")
    if has_xgb:
        joblib.dump(xgb, "model/xgboost_predictor.pkl")
        # Native archival format alongside the serving pickle (item: pickles
        # are version-sensitive; the JSON artifact loads across XGBoost versions).
        xgb.save_model("model/xgboost_predictor.json")

    # Sample ROC curve data (downsample for storage)
    roc_step = max(1, len(fpr) // 50)
    roc_data = {
        "fpr": [round(float(x), 4) for x in fpr[::roc_step]],
        "tpr": [round(float(x), 4) for x in tpr[::roc_step]],
        "auc": round(float(roc_auc_val), 4),
    }

    # Sample PR curve data
    pr_step = max(1, len(prec_curve) // 50)
    pr_data = {
        "precision": [round(float(x), 4) for x in prec_curve[::pr_step]],
        "recall": [round(float(x), 4) for x in rec_curve[::pr_step]],
        "auc": pr_auc_val,
        "auc_method": pr_metrics["pr_auc_method"],
        "average_precision": pr_metrics["average_precision"],
    }

    metadata = {
        "model_version": f"rf-xgb-synthetic-v6-{datetime.now().strftime('%Y%m%d')}",
        "model_type": "Ensemble (RF + XGBoost)" if has_xgb else "RandomForestClassifier",
        "library_versions": {
            "python": ".".join(map(str, __import__("sys").version_info[:3])),
            "scikit_learn": __import__("sklearn").__version__,
            "xgboost": __import__("xgboost").__version__ if has_xgb else None,
            "numpy": np.__version__,
            "pandas": pd.__version__,
        },
        "rf_params": {
            "n_estimators": 200, "max_depth": 12,
            "min_samples_split": 8, "min_samples_leaf": 4,
        },
        "xgb_params": {
            "n_estimators": 200, "max_depth": 8, "learning_rate": 0.1,
        } if has_xgb else None,
        "accuracy": round(float(ensemble_acc * 100), 1),
        "precision": round(float(precision * 100), 1),
        "recall": round(float(recall * 100), 1),
        "f1_score": round(float(f1 * 100), 1),
        "rf_accuracy": round(float(rf_acc * 100), 1),
        "xgb_accuracy": round(float(xgb_acc * 100), 1) if has_xgb else 0,
        "cv_accuracy": None,
        "cv_std": None,
        "evaluation_status": "group-disjoint synthetic classification; not future ATM/time prediction",
        "evaluation_slice": "group_holdout",
        "split_provenance": provenance,
        "future_outcome_metrics": future_outcome_metrics(),
        "target_semantics": "Synthetic cash-out Bernoulli outcome, distinct from injected fraud membership; not observed criminal cash-out",
        "shap_background": X_train.sample(n=min(64, len(X_train)), random_state=42).to_dict("records"),
        "roc_auc": round(float(roc_auc_val), 4),
        **pr_metrics,
        "confusion_matrix": {"tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)},
        "classification_report": report,
        "roc_curve": roc_data,
        "precision_recall_curve": pr_data,
        "feature_importance": importance[["feature", "ensemble_importance"]].to_dict("records"),
        "drift_metrics": drift,
        "drift_metric_method": "absolute_standardized_mean_shift_not_psi",
        "n_drifted_features": n_drifted,
        "ensemble_method": "weighted_average" if has_xgb else "single_model",
        "n_samples": len(df),
        "n_features": len(FEATURE_COLS),
        "feature_columns": FEATURE_COLS,
        "training_date": datetime.now().strftime("%Y-%m-%d"),
        "dataset": "synthetic_india_8cities_v6_grouped",
        "positive_ratio": round(float(df["cash_out_occurred"].mean()), 4),
        "cities": 8,
        "atms": 400,
    }

    class NpEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, (np.integer,)): return int(obj)
            if isinstance(obj, (np.floating,)): return float(obj)
            if isinstance(obj, (np.bool_,)): return bool(obj)
            if isinstance(obj, np.ndarray): return obj.tolist()
            return super().default(obj)

    provenance["artifact_sha256"] = {"random_forest": file_hash("model/cashout_predictor.pkl")}
    if has_xgb:
        provenance["artifact_sha256"]["xgboost"] = file_hash("model/xgboost_predictor.pkl")
    elif os.path.exists("model/xgboost_predictor.pkl"):
        # Do not silently load a stale estimator from a previous ensemble.
        os.remove("model/xgboost_predictor.pkl")

    with open("model/metadata.json", "w") as f:
        json.dump(metadata, f, indent=2, cls=NpEncoder)

    # Dataset stats
    stats = {
        "total_samples": len(df),
        "positive_ratio": float(df["cash_out_occurred"].mean()),
        "n_cities": 8,
        "n_atms": 400,
        "crime_distribution": df[df["cash_out_occurred"] == 1]["crime_type"].value_counts().to_dict()
            if "crime_type" in df.columns else {},
        "feature_stats": {},
    }
    stats["feature_stats_source"] = "training_partition_only"
    for col in FEATURE_COLS:
        stats["feature_stats"][col] = {
            "mean": float(X_train[col].mean()), "std": float(X_train[col].std()),
            "min": float(X_train[col].min()), "max": float(X_train[col].max()),
        }
    with open("model/dataset_stats.json", "w") as f:
        json.dump(stats, f, indent=2, cls=NpEncoder)

    print(f"\n{'='*60}")
    print(f"TRAINING COMPLETE")
    print(f"  Dataset:    {len(df):,} samples (8 cities, 400 ATMs)")
    print(f"  RF:         {rf_acc*100:.1f}% | grouped holdout only")
    if has_xgb:
        print(f"  XGB:        {xgb_acc*100:.1f}%")
    print(f"  Ensemble:   {ensemble_acc*100:.1f}% acc | {precision*100:.1f}% prec | {recall*100:.1f}% rec | {f1*100:.1f}% F1")
    print(f"  ROC AUC:    {roc_auc_val:.4f}")
    print(f"  PR AUC (trapezoid): {pr_auc_val:.4f}")
    print(f"  Average precision:  {pr_metrics['average_precision']:.4f}")
    print(f"  CM:         TP={tp} FP={fp} FN={fn} TN={tn}")
    print(f"  Mean shift (not PSI): {n_drifted}/{len(FEATURE_COLS)} heuristic flags")
    print(f"  Saved:      model/metadata.json, model/dataset_stats.json")
    print(f"{'='*60}")
    from revalidate_model import build_validation_report
    report = build_validation_report(df, metadata, rf, xgb if has_xgb else None)
    with open("model/validation_report.json", "w") as handle:
        json.dump(report, handle, indent=2, cls=NpEncoder)


if __name__ == "__main__":
    train_model()
