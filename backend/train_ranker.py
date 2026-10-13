"""A2.1 ranker: pointwise retrieval model on candidate rows.

Row model answers "how hot is the case" (velocity-dominated); this ranker
answers "which ATM" using ATM-varying features only. Trained on
training-split rings, validated on holdout candidate lists. Serving ranks
candidates by this ranker when present, falling back to row-score order.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

import generate_data as _gen
from ml_engine import RANKER_FEATURES
from revalidate_model import _case_context, build_candidate_features

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RANKER_PATH = os.path.join(BASE_DIR, "model", "ranker.pkl")
RANKER_META = os.path.join(BASE_DIR, "model", "ranker_metadata.json")


def build_ranker_rows(df, candidates, train_groups):
    import generate_data as _g
    np.random.seed(42)
    atms = {a["atm_id"]: a for a in _g.generate_atms()}
    by_city = {}
    for a in atms.values():
        by_city.setdefault(a["city"], []).append(a)
    cash = df[df["cash_out_occurred"] == 1]
    piv = cash.groupby(["month", "atm_id"]).size().unstack(fill_value=0)
    cum = piv.cumsum()
    city_max = cash.groupby("city")["atm_id"].apply(lambda s: int(s.value_counts().max()))

    def _past(m, atm):
        prev = [mm for mm in cum.index if mm < m]
        return int(cum.loc[max(prev), atm]) if prev and atm in cum.columns else 0

    rows, labels, case_ids = [], [], []
    train_cases = candidates[candidates["group_id"].isin(train_groups)]
    for _, part in train_cases.groupby("case_id"):
        ring = df[df["group_id"] == part["group_id"].iloc[0]]
        if ring.empty:
            continue
        ctx = _case_context(ring, part["group_id"].iloc[0])
        reg = by_city.get(ctx["city"], [])
        cmax = int(city_max.get(ctx["city"], 0))
        for _, cand in part.iterrows():
            feats = build_candidate_features(
                ctx, atms[cand["candidate_atm_id"]],
                _past(ctx["month"], cand["candidate_atm_id"]), cmax, reg)
            rows.append([feats[c] for c in RANKER_FEATURES])
            labels.append(int(cand["is_true"]))
            case_ids.append(part["case_id"].iloc[0])
    X = pd.DataFrame(rows, columns=RANKER_FEATURES)
    return X, np.array(labels), train_cases["case_id"].nunique(), np.array(case_ids)


def main():
    df = pd.read_csv(os.path.join(BASE_DIR, "data", "transactions_200k.csv"))
    candidates = pd.read_csv(os.path.join(BASE_DIR, "data", "candidates_eval.csv"))
    metadata = json.load(open(os.path.join(BASE_DIR, "model", "metadata.json")))
    train_groups = set(metadata["split_provenance"]["partitions"]["train"]["group_ids"])
    X, y, n_cases, _ = build_ranker_rows(df, candidates, train_groups)
    print(f"ranker rows: {len(X)} from {n_cases} training cases "
          f"({int(y.sum())} positives)")
    ranker = RandomForestClassifier(n_estimators=300, min_samples_leaf=5,
                                    class_weight="balanced", random_state=42,
                                    n_jobs=-1)
    ranker.fit(X, y)
    import joblib
    joblib.dump(ranker, RANKER_PATH)
    meta = {
        "model": "random-forest pointwise ranker (A2.1, evaluation only)",
        "features": RANK_FEATURES,
        "n_rows": int(len(X)),
        "n_cases": int(n_cases),
        "params": {"n_estimators": 300, "min_samples_leaf": 5,
                   "class_weight": "balanced", "random_state": 42},
        "scope": "synthetic candidate retrieval; not serving traffic",
    }
    json.dump(meta, open(RANKER_META, "w"), indent=2)
    print(f"saved {RANKER_PATH} + ranker_metadata.json")


def validate():
    """Score holdout candidate lists with the fitted ranker.

    Writes model/ranker_report.json. Reuses the row-model holdout groups
    from split provenance; asserts train/holdout ring disjointness first.
    """
    import joblib
    import statistics as _s
    df = pd.read_csv(os.path.join(BASE_DIR, "data", "transactions_200k.csv"))
    candidates = pd.read_csv(os.path.join(BASE_DIR, "data", "candidates_eval.csv"))
    metadata = json.load(open(os.path.join(BASE_DIR, "model", "metadata.json")))
    prov = metadata["split_provenance"]["partitions"]
    holdout = set()
    for name in ("group_holdout", "time_holdout", "location_holdout"):
        holdout |= set(prov[name]["group_ids"])
    train_groups = set(prov["train"]["group_ids"])
    assert not (holdout & train_groups), "train/holdout ring overlap"
    ranker = joblib.load(RANKER_PATH)
    X, y, _, case_ids = build_ranker_rows(df, candidates, holdout)
    proba = ranker.predict_proba(X)[:, 1]
    hits = {1: 0, 3: 0, 5: 0}
    ranks = []
    for case_id in pd.unique(case_ids):
        idx = np.flatnonzero(case_ids == case_id)
        o = idx[np.argsort(-proba[idx], kind="stable")]
        rank = int(np.where(y[o] == 1)[0][0]) + 1
        ranks.append(rank)
        for k in hits:
            if rank <= k:
                hits[k] += 1
    n = len(ranks)
    report = {
        "status": "available_synthetic_only",
        "n_cases": n,
        "hits": {f"top_{k}": f"{hits[k]}/{n}" for k in hits},
        "hit_rate": {f"top_{k}": round(hits[k] / n, 4) for k in hits},
        "mean_rank": round(float(_s.mean(ranks)), 2),
        "mrr": round(float(_s.mean([1.0 / r for r in ranks])), 4),
        "note": "A2.1 ranker (ATM-varying features) on holdout candidate lists. "
                "Synthetic retrieval, not real-world accuracy.",
    }
    json.dump(report, open(os.path.join(BASE_DIR, "model", "ranker_report.json"), "w"), indent=2)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
