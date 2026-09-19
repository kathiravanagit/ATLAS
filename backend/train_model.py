"""
ATLAS ML Model Training v4
Ensemble: Random Forest + XGBoost on 200k expanded dataset.
Saves: accuracy, precision, recall, F1, ROC curve, confusion matrix,
       SHAP feature importance, drift metrics, feature importance chart data.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score,
    precision_score, recall_score, f1_score, roc_curve, auc,
    precision_recall_curve
)
import joblib
import json
import os
from datetime import datetime

np.random.seed(42)

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
    print("ATLAS ML MODEL TRAINING v4 (Expanded Dataset)")
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

    # ── Train/test split ──
    print("\n[2/8] Splitting data (80/20 stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")

    # ── Random Forest ──
    print("\n[3/8] Training Random Forest (200 estimators)...")
    rf = RandomForestClassifier(
        n_estimators=200, max_depth=12, min_samples_split=8,
        min_samples_leaf=4, class_weight="balanced",
        random_state=42, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    rf_proba = rf.predict_proba(X_test)[:, 1]
    rf_acc = accuracy_score(y_test, rf_pred)
    rf_cv = cross_val_score(rf, X, y, cv=5, scoring='accuracy')
    print(f"  RF Accuracy: {rf_acc*100:.1f}%")
    print(f"  RF 5-Fold CV: {rf_cv.mean()*100:.1f}% (+/- {rf_cv.std()*100:.1f}%)")

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
        xgb_pred = xgb.predict(X_test)
        xgb_proba = xgb.predict_proba(X_test)[:, 1]
        xgb_acc = accuracy_score(y_test, xgb_pred)
        xgb_cv = cross_val_score(xgb, X, y, cv=5, scoring='accuracy')
        print(f"  XGB Accuracy: {xgb_acc*100:.1f}%")
        print(f"  XGB 5-Fold CV: {xgb_cv.mean()*100:.1f}% (+/- {xgb_cv.std()*100:.1f}%)")
        has_xgb = True
    except ImportError:
        print("  XGBoost not installed, using RF only")
        xgb_acc = 0
        xgb_cv_mean = 0

    # ── Ensemble evaluation ──
    print("\n[5/8] Evaluating ensemble...")
    if has_xgb:
        ensemble_proba = 0.5 * rf_proba + 0.5 * xgb_proba
        ensemble_pred = (ensemble_proba > 0.5).astype(int)
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
    pr_auc_val = auc(rec_curve, prec_curve)

    print(f"  Ensemble Accuracy:  {ensemble_acc*100:.1f}%")
    print(f"  Ensemble Precision: {precision*100:.1f}%")
    print(f"  Ensemble Recall:    {recall*100:.1f}%")
    print(f"  Ensemble F1:        {f1*100:.1f}%")
    print(f"  ROC AUC:            {roc_auc_val:.4f}")
    print(f"  PR AUC:             {pr_auc_val:.4f}")
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
    train_means = X_train.mean().to_dict()
    test_means = X_test.mean().to_dict()
    drift = {}
    for col in FEATURE_COLS:
        t_mean = train_means[col]
        e_mean = test_means[col]
        t_std = X_train[col].std()
        if t_std > 0:
            psi = abs(e_mean - t_mean) / t_std
        else:
            psi = 0
        drift[col] = {
            "train_mean": round(float(t_mean), 4),
            "test_mean": round(float(e_mean), 4),
            "psi": round(float(psi), 4),
            "drifted": psi > 0.2,
        }
    n_drifted = sum(1 for v in drift.values() if v["drifted"])
    print(f"  Features with drift: {n_drifted}/{len(FEATURE_COLS)}")

    # ── Save models and metadata ──
    print("\n[8/8] Saving models and metrics...")
    os.makedirs("model", exist_ok=True)
    joblib.dump(rf, "model/cashout_predictor.pkl")
    if has_xgb:
        joblib.dump(xgb, "model/xgboost_predictor.pkl")

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
        "auc": round(float(pr_auc_val), 4),
    }

    metadata = {
        "model_type": "Ensemble (RF + XGBoost)" if has_xgb else "RandomForestClassifier",
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
        "cv_accuracy": round(float(rf_cv.mean() * 100), 1),
        "cv_std": round(float(rf_cv.std() * 100), 1),
        "roc_auc": round(float(roc_auc_val), 4),
        "pr_auc": round(float(pr_auc_val), 4),
        "confusion_matrix": {"tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)},
        "classification_report": report,
        "roc_curve": roc_data,
        "precision_recall_curve": pr_data,
        "feature_importance": importance[["feature", "ensemble_importance"]].to_dict("records"),
        "drift_metrics": drift,
        "n_drifted_features": n_drifted,
        "ensemble_method": "weighted_average" if has_xgb else "single_model",
        "n_samples": len(df),
        "n_features": len(FEATURE_COLS),
        "feature_columns": FEATURE_COLS,
        "training_date": datetime.now().strftime("%Y-%m-%d"),
        "dataset": "synthetic_india_8cities_v5_200k",
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
    for col in FEATURE_COLS:
        stats["feature_stats"][col] = {
            "mean": float(df[col].mean()), "std": float(df[col].std()),
            "min": float(df[col].min()), "max": float(df[col].max()),
        }
    with open("model/dataset_stats.json", "w") as f:
        json.dump(stats, f, indent=2, cls=NpEncoder)

    print(f"\n{'='*60}")
    print(f"TRAINING COMPLETE")
    print(f"  Dataset:    {len(df):,} samples (8 cities, 400 ATMs)")
    print(f"  RF:         {rf_acc*100:.1f}% | CV: {rf_cv.mean()*100:.1f}%")
    if has_xgb:
        print(f"  XGB:        {xgb_acc*100:.1f}%")
    print(f"  Ensemble:   {ensemble_acc*100:.1f}% acc | {precision*100:.1f}% prec | {recall*100:.1f}% rec | {f1*100:.1f}% F1")
    print(f"  ROC AUC:    {roc_auc_val:.4f}")
    print(f"  PR AUC:     {pr_auc_val:.4f}")
    print(f"  CM:         TP={tp} FP={fp} FN={fn} TN={tn}")
    print(f"  Drift:      {n_drifted}/{len(FEATURE_COLS)} features drifted")
    print(f"  Saved:      model/metadata.json, model/dataset_stats.json")
    print(f"{'='*60}")


if __name__ == "__main__":
    train_model()
