"""Measure whether the first cash-out hour is predictable on unseen rings.

Phase 2 of ``docs/PS_GAP_PLAN.md`` asks this before any lead time is shown. The
answer is evidence, not a model: nothing is trained for serving and no artifact
is written.

Protocol
- Rows: injected fraud rings in ``data/transactions_200k.csv``.
- Split: ``train_model.establish_splits`` (seed 42), so no ring straddles the
  train/holdout boundary.
- Label: the circular first hour of the ring's cash-out-positive rows. Hours are
  rotated so evening (17-22) sorts before the generator's late-night (0-4)
  sub-pattern, then rotated back.
- Features: complaint-time columns only. ``hour`` and ``time_window_match`` are
  excluded because the second is derived from the first.
- Model: one RandomForest regression per held-out ring.
- Baselines: the training-set modal hour applied to every held-out ring, and a
  permutation of the held-out labels against the model's fixed predictions.
- Metric: hit rate within +/-1 hour, measured on the circle.

Run ``python measure_lead_time.py`` from ``backend/``.
"""
import argparse
import json
import os
import sys

import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from train_model import establish_splits  # noqa: E402

CSV_PATH = os.path.join(BASE_DIR, "data", "transactions_200k.csv")
SEED = 42
PERMUTATIONS = 2000
EVENING_START = 12  # rotate at noon so evening precedes the late-night sub-pattern

NUMERIC_FEATURES = [
    "amount",
    "num_mule_accounts",
    "month",
    "day_of_week",
    "historical_crime_density",
    "atm_type_score",
    "distance_from_victim_km",
    "suspect_distance_km",
    "recent_withdrawal_freq",
    "proximity_score",
    "density_score",
    "suspect_proximity",
    "amount_factor",
    "transaction_velocity",
    "atm_cashout_history",
    "local_hotspot_density",
]
CATEGORICAL_FEATURES = ["crime_type", "city"]
# Anything the generator derives from the label hour, or the label itself.
LABEL_DERIVED = {"hour", "time_window_match", "cash_out_occurred", "is_injected_fraud"}


def rotate_hour(hour) -> int:
    """Hours since noon: evening 17-22 -> 5-10, late night 0-4 -> 12-16."""
    return (int(hour) - EVENING_START) % 24


def first_cash_out_hour(hours) -> int:
    """Earliest cash-out hour in a ring, treating after-midnight as later."""
    return (min(rotate_hour(hour) for hour in hours) + EVENING_START) % 24


def rings_from_frame(df: pd.DataFrame) -> pd.DataFrame:
    """One row per fraud ring: aggregated complaint-time features plus the label.

    Features come from every row of the ring; the label comes only from rows
    whose cash-out actually occurred, so a ring whose first scheduled member
    did not cash out is labelled by its first real withdrawal.
    """
    required = (
        set(NUMERIC_FEATURES) | set(CATEGORICAL_FEATURES)
        | {"group_id", "is_injected_fraud", "cash_out_occurred", "hour"}
    )
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"missing columns: {sorted(missing)}")
    fraud = df[df["is_injected_fraud"].astype(bool)]
    positive = fraud[fraud["cash_out_occurred"] == 1]
    if positive.empty:
        raise ValueError("no cash-out-positive fraud rows to label")
    labels = positive.groupby("group_id")["hour"].apply(
        lambda hours: first_cash_out_hour(hours)
    )
    agg = {column: "median" for column in NUMERIC_FEATURES}
    agg.update({column: (lambda values: values.mode().iloc[0]) for column in CATEGORICAL_FEATURES})
    rings = fraud.groupby("group_id").agg(agg)
    rings["label"] = labels
    return rings.dropna(subset=["label"])


def load_rings(path: str = CSV_PATH) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(path)
    return rings_from_frame(df), df


def circular_hit_rate(predicted, truth) -> float:
    distance = np.abs(np.asarray(predicted) - np.asarray(truth))
    distance = np.minimum(distance, 24 - distance)
    return float((distance <= 1).mean())


def _model():
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder

    return Pipeline([
        ("features", ColumnTransformer([
            ("numeric", "passthrough", NUMERIC_FEATURES),
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ])),
        ("forest", RandomForestRegressor(
            n_estimators=300, min_samples_leaf=5, random_state=SEED, n_jobs=1)),
    ])


def evaluate(rings: pd.DataFrame, df: pd.DataFrame, splits: dict, partitions,
             seed: int = SEED, permutations: int = PERMUTATIONS) -> dict:
    train_groups = set(df.iloc[splits["train"]]["group_id"].astype(str)) & set(rings.index)
    holdout_groups = set()
    for name in partitions:
        holdout_groups |= set(df.iloc[splits[name]]["group_id"].astype(str))
    holdout_groups &= set(rings.index)
    if not train_groups or not holdout_groups:
        raise ValueError("empty train or holdout ring set")

    train = rings.loc[sorted(train_groups)]
    holdout = rings.loc[sorted(holdout_groups)]
    truth = holdout["label"].to_numpy()

    model = _model()
    model.fit(train, train["label"].map(rotate_hour))
    predicted = (np.rint(model.predict(holdout)).astype(int) + EVENING_START) % 24

    observed = circular_hit_rate(predicted, truth)
    mode = int(train["label"].mode().iloc[0])
    mode_hit = circular_hit_rate(np.full(len(holdout), mode), truth)

    rng = np.random.default_rng(seed)
    permuted = np.array([
        circular_hit_rate(predicted, rng.permutation(truth)) for _ in range(permutations)
    ])
    p_value = float((1 + (permuted >= observed).sum()) / (1 + permutations))

    return {
        "partitions": list(partitions),
        "train_rings": int(len(train)),
        "holdout_rings": int(len(holdout)),
        "hit_within_1h": round(observed, 4),
        "exact_hit": round(float((predicted == truth).mean()), 4),
        "p95_permutation": round(float(np.percentile(permuted, 95)), 4),
        "permutation_mean": round(float(permuted.mean()), 4),
        "permutation_p": round(p_value, 4),
        "modal_hour": mode,
        "modal_hour_hit": round(mode_hit, 4),
        "better_than_permutation": bool(p_value < 0.05),
    }


def measure(csv_path: str = CSV_PATH, seed: int = SEED,
            permutations: int = PERMUTATIONS) -> dict:
    rings, df = load_rings(csv_path)
    splits, provenance = establish_splits(df, seed=seed)
    group = evaluate(rings, df, splits, ["group_holdout"], seed, permutations)
    union = evaluate(
        rings, df, splits,
        ["group_holdout", "time_holdout", "location_holdout"],
        seed, permutations,
    )
    predictable = bool(group["better_than_permutation"] or union["better_than_permutation"])
    return {
        "question": "Is the first cash-out hour predictable on unseen rings better than a permutation of the same labels?",
        "label": "circular first cash-out hour per fraud ring",
        "label_distribution": {
            str(int(hour)): int(count)
            for hour, count in rings["label"].value_counts().sort_index().items()
        },
        "features": NUMERIC_FEATURES + CATEGORICAL_FEATURES,
        "excluded": sorted(LABEL_DERIVED),
        "dataset_sha256": provenance["dataset_sha256"],
        "seed": seed,
        "permutations": permutations,
        "group_holdout": group,
        "all_holdouts": union,
        "predictable": predictable,
        "conclusion": (
            "Report a lead-time distribution only after replacing the fixtures with timestamped outcomes."
            if predictable else
            "No better than permutation; do not report a lead time from this dataset."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default=CSV_PATH)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--permutations", type=int, default=PERMUTATIONS)
    args = parser.parse_args()
    print(json.dumps(measure(args.csv, args.seed, args.permutations), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
