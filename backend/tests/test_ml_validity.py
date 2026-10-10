"""Lightweight ML validity checks; no fitting, artifact writes, or application import.

Standalone: python -B -m pytest --noconftest -p no:cacheprovider backend/tests/test_ml_validity.py
"""
import copy
import json
from pathlib import Path
import sys
import types

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import generate_data
import ml_engine as ml
import revalidate_model as validation
import train_model as training


class LinearProbabilityModel:
    def __init__(self, intercept, slope):
        self.intercept = intercept
        self.slope = slope
        self.feature_importances_ = np.ones(len(ml.FEATURE_COLS)) / len(ml.FEATURE_COLS)

    def predict_proba(self, X):
        values = np.asarray(X, dtype=float)
        p = self.intercept + self.slope * values[:, 0]
        return np.column_stack([1 - p, p])


@pytest.fixture
def frame():
    rows = []
    for group in range(30):
        for target in (0, 1):
            row = {col: 0.0 for col in ml.FEATURE_COLS}
            row.update(transaction_id=f"T-{group}-{target}", group_id=f"G-{group}",
                       city="kolkata" if group < 4 else "chennai",
                       month=12 if 4 <= group < 8 else 3,
                       feature_protocol=training.FEATURE_PROTOCOL,
                       cash_out_occurred=target, hour=12,
                       distance_from_victim_km=target)
            rows.append(row)
    # Earlier rows related to a future/city group must be purged, not trained.
    for source in (rows[0], rows[8]):
        row = dict(source, transaction_id=f"EARLY-{source['group_id']}", city="chennai", month=1)
        rows.append(row)
    return pd.DataFrame(rows)


@pytest.fixture
def models(monkeypatch):
    rf = LinearProbabilityModel(0.1, 0.2)
    xgb = LinearProbabilityModel(0.3, 0.4)
    background = {col: 0.0 for col in ml.FEATURE_COLS}
    background["hour"] = 12.0
    monkeypatch.setattr(ml, "load_models", lambda: (rf, xgb))
    monkeypatch.setattr(ml, "_metadata", {"shap_background": [background]})
    monkeypatch.setattr(ml, "_dataset_stats", None)
    monkeypatch.setattr(ml, "_shap_explainer", None)
    monkeypatch.setattr(ml, "_shap_explainer_key", None)
    monkeypatch.setattr(ml, "_shap_cache", {})
    return rf, xgb, background


def test_exclusions_are_disjoint_reproducible_and_preserve_ids(frame):
    splits, provenance = training.establish_splits(frame)
    again, repeated = training.establish_splits(frame)
    assert provenance == repeated
    all_indices = np.concatenate(list(splits.values()))
    assert sorted(all_indices) == list(range(len(frame)))
    for name, indices in splits.items():
        np.testing.assert_array_equal(indices, again[name])
        assert provenance["partitions"][name]["row_ids"] == frame.iloc[indices].transaction_id.tolist()
    names = ("train", "group_holdout", "location_holdout", "time_holdout")
    groups = {name: set(frame.iloc[splits[name]].group_id) for name in names}
    for i, name in enumerate(names):
        for other in names[i + 1:]:
            assert groups[name].isdisjoint(groups[other])
    train = frame.iloc[splits["train"]]
    assert not train.city.isin(training.HOLDOUT_CITIES).any()
    assert (train.month < training.TIME_CUTOFF_MONTH).all()
    assert set(frame.iloc[splits["purged"]].transaction_id) == {"EARLY-G-0", "EARLY-G-4"}
    assert len(provenance["dataset_sha256"]) == 64
    assert provenance["protocol"] == training.SPLIT_PROTOCOL


def test_training_establishes_exclusions_before_fit(monkeypatch, frame):
    splits, _ = training.establish_splits(frame)
    expected = frame.iloc[splits["train"]]
    monkeypatch.setattr(training, "load_expanded_dataset", lambda: frame)

    class StopBeforeExpensiveFit(Exception):
        pass

    class SpyForest:
        def __init__(self, **kwargs):
            pass

        def fit(self, X, y):
            pd.testing.assert_frame_equal(X, expected[ml.FEATURE_COLS])
            pd.testing.assert_series_equal(y, expected.cash_out_occurred)
            raise StopBeforeExpensiveFit

    monkeypatch.setattr(training, "RandomForestClassifier", SpyForest)
    with pytest.raises(StopBeforeExpensiveFit):
        training.train_model()


def test_legacy_data_without_groups_or_feature_protocol_rejected(frame):
    with pytest.raises(ValueError, match="Regenerate"):
        training.establish_splits(frame.drop(columns="group_id"))
    frame["feature_protocol"] = "old-oracle"
    with pytest.raises(ValueError, match="oracle"):
        training.establish_splits(frame)
    frame["feature_protocol"] = training.FEATURE_PROTOCOL
    frame.loc[0, "time_window_match"] = 1.0
    with pytest.raises(ValueError, match="observable serving"):
        training.establish_splits(frame)


def test_provenance_binds_dataset_splits_and_model_artifacts(monkeypatch, frame):
    _, provenance = training.establish_splits(frame)
    provenance["artifact_sha256"] = {"random_forest": "rf-digest"}
    metadata = {"split_provenance": provenance}
    monkeypatch.setattr(validation.os.path, "exists", lambda path: True)
    monkeypatch.setattr(validation, "file_hash", lambda path: "rf-digest")
    paths = {"random_forest": "mock-artifact"}
    validation.validate_provenance(frame, metadata, paths)
    changed = frame.copy()
    changed.loc[0, "amount"] = 123.0
    with pytest.raises(ValueError, match="dataset_sha256"):
        validation.validate_provenance(changed, metadata, paths)
    tampered = copy.deepcopy(metadata)
    tampered["split_provenance"]["partitions"]["train"]["row_ids"].append("FAKE")
    with pytest.raises(ValueError, match="partitions"):
        validation.validate_provenance(frame, tampered, paths)
    monkeypatch.setattr(validation, "file_hash", lambda path: "other-weights")
    with pytest.raises(ValueError, match="artifacts"):
        validation.validate_provenance(frame, metadata, paths)


@pytest.mark.parametrize("corruption", ["row_overlap", "group_overlap", "missing_row", "invalid_position"])
def test_revalidation_rejects_actual_invalid_partitions(monkeypatch, frame, corruption):
    splits, provenance = training.establish_splits(frame)
    splits = {name: indices.copy() for name, indices in splits.items()}
    if corruption == "row_overlap":
        splits["group_holdout"][0] = splits["train"][0]
    elif corruption == "group_overlap":
        # Swap a single row of two multi-row groups: all row IDs remain unique,
        # but related rows now straddle training and evaluated holdout partitions.
        train_row, test_row = splits["train"][0], splits["group_holdout"][0]
        splits["train"][0], splits["group_holdout"][0] = test_row, train_row
    elif corruption == "missing_row":
        splits["train"] = splits["train"][1:]
    else:
        splits["train"][0] = -1
    # Even a broken splitter claiming correct provenance must be checked against
    # its actual indices rather than trusted because its hashes look valid.
    monkeypatch.setattr(validation, "establish_splits", lambda *args, **kwargs: (splits, provenance))
    with pytest.raises(ValueError, match="partitions|positions"):
        validation.validate_provenance(frame, {"split_provenance": provenance})


@pytest.mark.parametrize("exclusion", ["city", "time"])
def test_actual_exclusion_checks_reject_training_leakage(frame, exclusion):
    splits, _ = training.establish_splits(frame)
    index = splits["train"][0]
    if exclusion == "city":
        frame.loc[index, "city"] = "kolkata"
    else:
        frame.loc[index, "month"] = 12
    with pytest.raises(ValueError, match="City/time exclusions leak"):
        training.validate_split_disjointness(frame, splits, training.HOLDOUT_CITIES, training.TIME_CUTOFF_MONTH)


def test_provenance_uses_real_content_hashes_and_rejects_missing_artifacts(monkeypatch, frame):
    import hashlib
    import io

    _, provenance = training.establish_splits(frame)
    payload = b"mock model artifact bytes, not a fitted model"
    digest = hashlib.sha256(payload).hexdigest()
    provenance["artifact_sha256"] = {"random_forest": digest}
    monkeypatch.setattr(training, "open", lambda *args, **kwargs: io.BytesIO(payload), raising=False)
    monkeypatch.setattr(validation.os.path, "exists", lambda path: True)
    paths = {"random_forest": "mock-artifact"}
    assert training.file_hash("mock-artifact") == digest
    validation.validate_provenance(frame, {"split_provenance": provenance}, paths)
    payload = b"different artifact content"
    with pytest.raises(ValueError, match="artifacts"):
        validation.validate_provenance(frame, {"split_provenance": provenance}, paths)
    monkeypatch.setattr(validation.os.path, "exists", lambda path: False)
    with pytest.raises(ValueError, match="artifacts"):
        validation.validate_provenance(frame, {"split_provenance": provenance}, paths)


def test_estimator_set_mismatch_is_unavailable_without_scoring(monkeypatch, frame):
    _, provenance = training.establish_splits(frame)
    provenance["artifact_sha256"] = {"random_forest": "digest"}
    monkeypatch.setattr(validation.os.path, "exists", lambda path: True)
    monkeypatch.setattr(validation, "file_hash", lambda path: "digest")

    class NeverScore:
        def predict_proba(self, X):
            pytest.fail("Mismatched fitted estimator set must not be scored")

    report = validation.build_validation_report(
        frame, {"split_provenance": provenance}, NeverScore(), NeverScore(),
        {"random_forest": "mock-artifact"},
    )
    assert report["status"] == "unavailable"
    assert "estimator set" in report["slices"]["group_holdout"]["reason"]


def test_pr_auc_and_average_precision_are_distinct_and_consistent():
    from sklearn.metrics import auc, average_precision_score, precision_recall_curve

    y = np.array([0, 1, 0, 1])
    scores = np.array([0.9, 0.8, 0.7, 0.6])
    precision, recall, _ = precision_recall_curve(y, scores)
    metrics = training.precision_recall_metrics(y, scores)
    assert metrics["pr_auc"] == round(float(auc(recall, precision)), 4)
    assert metrics["average_precision"] == round(float(average_precision_score(y, scores)), 4)
    assert metrics["pr_auc"] != metrics["average_precision"]
    assert metrics["pr_auc_method"] == "trapezoidal_precision_recall_curve"
    assert metrics["average_precision_method"] == "sklearn.average_precision_score"
    measured = validation.slice_metrics("mock", y, scores)
    for key, value in metrics.items():
        assert measured[key] == value
    frame = pd.DataFrame({"distance_from_victim_km": [1, 2, 3, 4],
                          "historical_crime_density": [4, 3, 2, 1]})
    baselines = validation.baseline_comparison(frame, y, scores)
    for key, value in metrics.items():
        assert baselines["atlas_ensemble"][key] == value
    constant = training.precision_recall_metrics(y, np.zeros(len(y)))
    assert baselines["no_alert"]["pr_auc"] == constant["pr_auc"]
    assert baselines["no_alert"]["average_precision"] == constant["average_precision"]


def test_training_drift_is_standardized_mean_shift_not_psi():
    train = pd.DataFrame({"varying": [0.0, 2.0], "constant": [1.0, 1.0]})
    test = pd.DataFrame({"varying": [2.0, 4.0], "constant": [2.0, 2.0]})
    diagnostics = training.mean_shift_diagnostics(train, test)
    assert diagnostics["varying"]["mean_shift_z"] == round(2.0 / train.varying.std(), 4)
    assert diagnostics["varying"]["drifted"]
    assert diagnostics["constant"]["mean_shift_z"] is None
    assert diagnostics["constant"]["drifted"]
    assert "standard deviation" in diagnostics["constant"]["reason"]
    for diagnostic in diagnostics.values():
        assert "psi" not in diagnostic
        assert diagnostic["metric_method"] == "absolute_standardized_mean_shift_not_psi"


def test_legacy_revalidation_does_not_score_any_rows(frame):
    class NeverScore:
        def predict_proba(self, X):
            pytest.fail("Train-inclusive legacy data must not be scored as a holdout")

    report = validation.build_validation_report(frame, {}, NeverScore(), NeverScore())
    assert report["status"] == "unavailable"
    assert all(s["status"] == "unavailable" for s in report["slices"].values())
    assert report["baseline_comparison"]["status"] == "unavailable"
    assert "NOT a random sample" in report["previous_prefix_diagnostic"]["selection"]
    assert "calibration_random_sample" not in report


def test_valid_revalidation_scores_only_pre_fit_exclusions(monkeypatch, frame):
    splits, provenance = training.establish_splits(frame)
    provenance["artifact_sha256"] = {"random_forest": "digest"}
    monkeypatch.setattr(validation.os.path, "exists", lambda path: True)
    monkeypatch.setattr(validation, "file_hash", lambda path: "digest")
    seen = []

    class SpyModel:
        def predict_proba(self, X):
            seen.extend(X.index.tolist())
            p = 0.2 + 0.6 * X.distance_from_victim_km.to_numpy()
            return np.column_stack([1 - p, p])

    report = validation.build_validation_report(
        frame, {"split_provenance": provenance}, SpyModel(), None,
        {"random_forest": "mock-artifact"},
    )
    assert report["status"] == "available_synthetic_only"
    assert set(seen).isdisjoint(set(splits["train"]))
    assert set(seen) == set(np.concatenate([splits[n] for n in ("group_holdout", "time_holdout", "location_holdout")]))
    for name in report["slices"]:
        assert report["slices"][name]["n"] == len(splits[name])


@pytest.mark.parametrize("layout", ["scalar", "binary_ndarray", "binary_list"])
def test_shap_exact_ensemble_function_expected_value_and_ndarray(models, monkeypatch, layout):
    rf, xgb, background = models
    calls = []

    class MockKernelExplainer:
        def __init__(self, function, bg):
            assert bg.to_dict("records") == [background]
            # Base is ensemble mean (0.2), not RF-only (0.1) or fixed 0.5.
            self.function = function
            self.expected_value = 0.2 if layout == "scalar" else np.array([0.8, 0.2])
            np.testing.assert_allclose(function(bg), [0.2])

        def shap_values(self, X, nsamples):
            calls.append(X.iloc[0, 0])
            values = np.zeros((1, len(ml.FEATURE_COLS)))
            values[0, 0] = self.function(X)[0] - 0.2
            if layout == "binary_ndarray":
                return np.stack([-values, values], axis=-1)
            if layout == "binary_list":
                return [-values, values]
            return values

    monkeypatch.setitem(sys.modules, "shap", types.SimpleNamespace(KernelExplainer=MockKernelExplainer))
    features = dict(background, distance_from_victim_km=1.0)
    result = ml.explain_cashout(features, case_id="same-case")
    assert result["available"] and result["local_attribution"]
    assert result["method"] == "kernel_shap_ensemble"
    assert result["base_value"] == pytest.approx(0.2)
    assert result["probability"] == pytest.approx(0.5)
    assert result["base_value"] + sum(c["contribution"] for c in result["contributions"]) == pytest.approx(0.5)
    assert ml.predict_cashout(features)["probability"] == pytest.approx(result["probability"])
    ml.explain_cashout(features, case_id="another-case")
    assert len(calls) == 1  # identical input is shared across cases
    changed = dict(features, distance_from_victim_km=0.5)
    assert ml.explain_cashout(changed, case_id="same-case")["probability"] == pytest.approx(0.35)
    assert len(calls) == 2  # same case, different input is not reused
    rf.intercept = 0.2
    refreshed = ml.explain_cashout(features, case_id="same-case")
    # Mock's base is now deliberately wrong: stale cache must not mask it.
    assert not refreshed["available"]


def test_prediction_uses_unrounded_ensemble_probability(models):
    rf, xgb, features = models
    rf.intercept = 0.123456
    xgb.intercept = 0.345678
    prediction = ml.predict_cashout(features)
    assert prediction["probability"] == pytest.approx(0.234567, abs=1e-12)
    assert prediction["model_weights"] == {"random_forest": 0.5, "xgboost": 0.5}


def test_shap_additivity_failure_is_not_reported_as_local(models, monkeypatch):
    _, _, features = models

    class BadExplainer:
        expected_value = 0.9

        def shap_values(self, X, nsamples):
            return np.zeros((1, len(ml.FEATURE_COLS)))

    monkeypatch.setattr(ml, "_init_shap_explainer", lambda: BadExplainer())
    result = ml.explain_cashout(features)
    assert not result["available"] and not result["local_attribution"]
    assert result["base_value"] is None
    assert "additivity" in result["reason"]


def test_global_importance_is_not_a_local_attribution(models, monkeypatch):
    _, _, features = models
    monkeypatch.setattr(ml, "_metadata", {})
    monkeypatch.setitem(sys.modules, "shap", types.SimpleNamespace())
    result = ml.explain_cashout(features)
    assert not result["local_attribution"]
    assert result["base_value"] is None
    assert result["method"] == "global_feature_importance"
    assert "empirical" in result["reason"]
    assert all(c["contribution"] is None and c["direction"] == "not_local" for c in result["contributions"])
    assert ml.compute_shap_values(features) == []
    prediction = ml.predict_cashout(features)
    assert prediction["contributions_method"] == "global_feature_importance_not_local_attribution"


@pytest.mark.parametrize("failure", ["missing", "corrupt"])
def test_unavailable_model_never_returns_neutral_valid_risk(monkeypatch, failure):
    def load():
        if failure == "corrupt":
            raise OSError("corrupt artifact")
        return None, None

    monkeypatch.setattr(ml, "load_models", load)
    result = ml.predict_cashout({})
    assert result["error_code"] == "MODEL_UNAVAILABLE"
    assert not result["available"]
    assert result["risk_score"] is None and result["confidence"] is None
    assert ml.explain_cashout({})["error_code"] == "MODEL_UNAVAILABLE"
    with pytest.raises(ValueError, match="MODEL_UNAVAILABLE"):
        validation.ensemble_proba(None, None, pd.DataFrame())


def test_synthetic_hit_at_k_reported_with_honest_scope():
    model_dir = Path(ml.MODEL_DIR)
    report = json.loads((model_dir / "validation_report.json").read_text())
    hit = report["synthetic_hit_at_k"]
    assert hit["status"] == "available_synthetic_only"
    assert hit["n_units"] >= 3
    for key in ("top_1", "top_3", "top_5"):
        rate = hit["hit_rate"][key]
        assert rate is None or 0.0 <= rate <= 1.0
    assert "synthetic" in hit["note"].lower()
    assert "not real-world" in hit["note"].lower()


def test_future_metrics_and_checked_in_claims_are_unavailable():
    future = training.future_outcome_metrics()
    assert future["status"] == "unavailable"
    assert all(future[key] is None for key in ("next_atm_top1", "next_atm_top3", "next_atm_top5", "next_cashout_time_mae"))
    model_dir = Path(ml.MODEL_DIR)
    metadata = json.loads((model_dir / "metadata.json").read_text())
    assert "top_k_accuracy" not in metadata
    if not metadata.get("split_provenance"):
        assert metadata["accuracy"] is None
        report = json.loads((model_dir / "validation_report.json").read_text())
        assert report["status"] == "unavailable"
        assert report["baseline_comparison"]["status"] == "unavailable"


def test_generator_ring_geography_groups_and_observable_time_window():
    state = np.random.get_state()
    try:
        np.random.seed(42)
        atms = generate_data.generate_atms()
        rows = generate_data.generate_transactions(atms, n_transactions=1200)
    finally:
        np.random.set_state(state)
    rings = rows[rows.is_injected_fraud]
    assert len(rings) == 18
    assert rings.groupby("group_id").atm_id.nunique().eq(1).all()
    assert rings.groupby("group_id").city.nunique().eq(1).all()
    assert rings.groupby("group_id").month.nunique().eq(1).all()
    lookup = {atm["atm_id"]: atm for atm in atms}
    for row in rings.itertuples():
        atm = lookup[row.atm_id]
        distance = generate_data.haversine(row.victim_lat, row.victim_lng, atm["lat"], atm["lng"])
        assert distance < 6.0  # local ring jitter, never another city's ATM
        assert row.distance_from_victim_km == pytest.approx(distance, abs=0.006)
        assert row.city == atm["city"]
    np.testing.assert_array_equal(rows.time_window_match, rows.hour.between(17, 22).astype(float))
    assert set(rows.feature_protocol) == {training.FEATURE_PROTOCOL}
    assert rows.loc[~rows.is_injected_fraud, "group_id"].is_unique
    # Membership and stochastic target are distinct, not interchangeable labels.
    assert rows.loc[~rows.is_injected_fraud, "cash_out_occurred"].sum() > 0
