"""The generator knobs must be opt-in and must actually move the world.

The sweep in ``assumption_sweep.py`` is only meaningful if two things hold:
passing no assumptions reproduces the shipped generator exactly, and passing
one assumption changes the drawn data in the direction it claims to.
"""
import numpy as np
import pandas as pd
import pytest

import generate_data as gen
import train_ranker as tr
import assumption_sweep as sw


@pytest.fixture()
def rng_state():
    state = np.random.get_state()
    try:
        yield
    finally:
        np.random.set_state(state)


def small_world(assumptions=None, n=1200):
    atms = gen.generate_atms(assumptions)
    rows = gen.generate_transactions(atms, n_transactions=n, assumptions=assumptions)
    return atms, rows


def test_assumptions_default_to_the_shipped_generator():
    assert gen._assumptions(None) == gen.DEFAULT_ASSUMPTIONS
    assert gen._assumptions({}) == gen.DEFAULT_ASSUMPTIONS
    merged = gen._assumptions({"timing_coupling": False})
    assert merged["timing_coupling"] is False
    assert merged["amount_shape"] == "default"
    # The documented defaults are also the no-op values.
    assert gen.DEFAULT_ASSUMPTIONS == {
        "timing_coupling": True, "ring_scale": 1.0, "amount_shape": "default",
        "atm_jitter_m": 0.0, "label_noise": 0.0,
    }


@pytest.mark.parametrize("bad", [
    {"not_a_knob": 1},
    {"amount_shape": "spiky"},
    {"ring_scale": 0.0},
    {"atm_jitter_m": -5.0},
    {"label_noise": 1.5},
])
def test_assumptions_reject_unknown_or_invalid_values(bad):
    with pytest.raises((KeyError, ValueError)):
        gen._assumptions(bad)


def test_registry_matches_the_committed_file(rng_state):
    from pathlib import Path
    committed = pd.read_csv(Path(gen.__file__).parent / "data" / "atms_400.csv")
    np.random.seed(42)
    generated = pd.DataFrame(gen.generate_atms())
    assert generated.astype(str).equals(committed.astype(str))


def test_default_world_is_reproducible(rng_state):
    np.random.seed(42)
    _, first = small_world()
    np.random.seed(42)
    _, second = small_world()
    pd.testing.assert_frame_equal(first, second)


def test_knobs_do_not_leak_into_the_default_stream(rng_state):
    np.random.seed(42)
    _, plain = small_world()
    np.random.seed(42)
    _, explicit = small_world(gen.DEFAULT_ASSUMPTIONS)
    pd.testing.assert_frame_equal(plain, explicit)


def test_timing_knob_removes_the_evening_window(rng_state):
    np.random.seed(42)
    _, coupled = small_world()
    np.random.seed(42)
    _, uncoupled = small_world({"timing_coupling": False})
    coupled_share = coupled.loc[coupled.is_injected_fraud, "hour"].between(17, 22).mean()
    uncoupled_share = uncoupled.loc[uncoupled.is_injected_fraud, "hour"].between(17, 22).mean()
    assert coupled_share > 0.6
    assert uncoupled_share < 0.45
    # The serving rule is unchanged: the observable window is always recomputed
    # from the reported hour, whatever the generator assumed.
    assert (uncoupled.time_window_match == uncoupled.hour.between(17, 22).astype(float)).all()


def test_ring_scale_widens_the_mule_count(rng_state):
    np.random.seed(42)
    _, base = small_world()
    np.random.seed(42)
    _, wide = small_world({"ring_scale": 2.0})
    base_mules = base.loc[base.is_injected_fraud, "num_mule_accounts"].mean()
    wide_mules = wide.loc[wide.is_injected_fraud, "num_mule_accounts"].mean()
    assert wide_mules > base_mules


def test_amount_shape_changes_the_loss_distribution(rng_state):
    np.random.seed(42)
    _, base = small_world()
    np.random.seed(42)
    _, flat = small_world({"amount_shape": "flat"})
    np.random.seed(42)
    _, wide = small_world({"amount_shape": "wide"})
    legit = ~base.is_injected_fraud
    assert not np.allclose(base.loc[legit, "amount"], flat.loc[legit, "amount"])
    # A wider shape must produce a larger spread, not merely a different draw.
    assert wide.loc[legit, "amount"].std() > base.loc[legit, "amount"].std()


def test_label_noise_flips_outcomes_before_they_reach_history(rng_state):
    np.random.seed(42)
    _, clean = small_world()
    np.random.seed(42)
    _, noisy = small_world({"label_noise": 0.2})
    flips = int((clean.cash_out_occurred != noisy.cash_out_occurred).sum())
    assert flips > 0
    # The history feature is rebuilt from the corrupted outcomes, so it must
    # move as well; otherwise the knob would only relabel and change nothing.
    assert not np.allclose(clean.atm_cashout_history, noisy.atm_cashout_history)


def test_geography_knob_moves_every_atm(rng_state):
    np.random.seed(42)
    plain = gen.generate_atms()
    np.random.seed(42)
    jittered = gen.generate_atms({"atm_jitter_m": 1000.0})
    assert [a["atm_id"] for a in plain] == [a["atm_id"] for a in jittered]
    moved = [gen.haversine(a["lat"], a["lng"], b["lat"], b["lng"])
             for a, b in zip(plain, jittered)]
    assert min(moved) > 0.0
    # 1 km of Gaussian noise per axis is ~1.4 km of ground displacement, and
    # the offset field is drawn from its own stream so the baseline world is
    # otherwise untouched.
    assert 0.9 < float(np.mean(moved)) < 2.0
    assert len({a["city"] for a in jittered}) == len({a["city"] for a in plain})


def test_candidate_pool_size_knob(rng_state):
    np.random.seed(42)
    atms, rows = small_world()

    def sizes(n_hard, n_easy):
        candidates = gen.generate_candidate_lists(rows, atms, n_hard=n_hard, n_easy=n_easy)
        return candidates.groupby("case_id").size()

    assert set(sizes(6, 8)) == {15}
    assert set(sizes(2, 2)) == {5}
    assert set(sizes(24, 25)) == {50}


def _world_row(name, kind, seed, hit, rank=1.7, mrr=0.8, chance=None):
    """The subset of a sweep row that aggregation and rendering read."""
    metrics = {"status": "available_synthetic_only", "n_cases": 429,
               "hit_rate": {"top_1": 0.69, "top_3": hit, "top_5": 0.95},
               "mean_rank": rank, "mrr": mrr}
    # Case ranks that shift with the seed, so cross-draw churn is non-zero.
    case_ranks = {f"RING-{i:06d}": (5 if (i + seed) % 10 == 0 else 1)
                  for i in range(20)}
    return {
        "run_id": f"{name}@{seed}", "name": name, "kind": kind, "seed": seed,
        "changed": f"{name} changed", "chance_top3": chance,
        "assumptions": {}, "world": {"n_rings": 1000, "n_candidates_per_case": 15,
                                     "cashout_rate": 0.04, "ring_evening_share": 0.8,
                                     "ring_mean_mules": 3.0, "ring_mean_amount": 60000.0,
                                     "history_mean": 0.05},
        "serving_ranker": dict(metrics), "ensemble": dict(metrics),
        "case_ranks": {"serving_ranker": dict(case_ranks),
                       "ensemble": dict(case_ranks)},
    }


def test_aggregate_pairs_each_draw_with_the_baseline_of_the_same_seed():
    """Pairing seed 7's knob against seed 42's baseline would invent a delta."""
    rows = [_world_row("baseline", "baseline", 42, 0.90),
            _world_row("baseline", "baseline", 7, 0.80),
            _world_row("baseline", "baseline", 13, 0.70),
            _world_row("timing_removed", "knob", 42, 0.85),
            _world_row("timing_removed", "knob", 7, 0.75),
            _world_row("timing_removed", "knob", 13, 0.65)]
    table = {entry["name"]: entry for entry in sw.aggregate(rows)}
    stats = table["timing_removed"]["serving_ranker"]
    assert stats["deltas"] == [-0.05, -0.05, -0.05]
    assert stats["mean_delta"] == pytest.approx(-0.05)
    assert stats["min_delta"] == stats["max_delta"] == pytest.approx(-0.05)
    # The baseline row anchors on the first configured seed for case counts, but
    # its rate is the mean over the same draws the knobs use.
    assert table["baseline"]["seeds"] == [42]
    assert table["baseline"]["serving_ranker"]["hit_rates"] == [0.90, 0.80, 0.70]
    assert table["baseline"]["serving_ranker"]["mean_hit_rate"] == pytest.approx(0.80)


def test_aggregate_keeps_per_seed_spread_when_the_mean_cancels():
    rows = [_world_row("baseline", "baseline", 42, 0.90),
            _world_row("baseline", "baseline", 7, 0.80),
            _world_row("baseline", "baseline", 13, 0.70),
            _world_row("knob", "knob", 42, 0.80),
            _world_row("knob", "knob", 7, 0.80),
            _world_row("knob", "knob", 13, 0.80)]
    stats = {e["name"]: e for e in sw.aggregate(rows)}["knob"]["serving_ranker"]
    assert stats["mean_delta"] == pytest.approx(0.0)
    assert (stats["min_delta"], stats["max_delta"]) == (-0.1, 0.1)


def test_verdicts_use_the_control_band_and_skip_task_rows():
    rows = [_world_row("baseline", "baseline", 42, 0.90),
            _world_row("baseline", "baseline", 7, 0.89)]
    spread = sw.control_spread(rows)
    band = spread["serving_ranker"]["band"]
    assert band == pytest.approx(0.005)

    inside = _world_row("inside", "knob", 42, 0.902)
    outside = _world_row("outside", "knob", 42, 0.95)
    task = _world_row("pool", "task", 42, 0.99, chance=0.6)
    for row in (inside, outside, task):
        row["serving_ranker"]["hit_rate"]["top_3"] -= 0.0
    table = sw.aggregate(rows + [inside, outside, task])
    table = sw.with_verdicts(table, spread)
    verdicts = {entry["name"]: entry["serving_ranker_verdict"] for entry in table}
    assert verdicts["baseline"] == "baseline"
    assert verdicts["inside"].startswith("within noise")
    assert verdicts["outside"].startswith("beyond noise")
    assert verdicts["pool"].startswith("not comparable")
    # A task row must not be allowed to set the headline bound.
    assert sw.bounds(table, "serving_ranker")["name"] == "outside"


def test_two_se_matches_the_frozen_baseline():
    assert sw.two_se(0.9068, 429) == pytest.approx(0.0281, abs=5e-5)
    assert sw.two_se(None, 429) is None
    assert sw.two_se(0.5, 0) is None


def test_render_markdown_produces_both_tables_from_a_report():
    rows = [_world_row("baseline", "baseline", 42, 0.90)]
    for seed in (7, 13, 21, 34, 55):
        rows.append(_world_row("baseline", "baseline", seed, 0.88 + seed / 1000))
    for seed in (42, 7, 13):
        rows.append(_world_row("timing_removed", "knob", seed, 0.91))
    table = sw.with_verdicts(sw.aggregate(rows), sw.control_spread(rows))
    report = {
        "configs": table,
        "control_spread": sw.control_spread(rows),
        "noise_floor": {key: sw.control_spread(rows)[key]["band"]
                        for key in ("serving_ranker", "ensemble")},
        "n_cases": {"serving_ranker": 429, "ensemble": 429},
        "two_se": {"serving_ranker": 0.0281, "ensemble": 0.0454},
        "bounds": {key: sw.bounds(table, key) for key in ("serving_ranker", "ensemble")},
        "cross_draw_churn": sw.cross_draw_churn(rows),
        "worlds": {row["run_id"]: row["world"] for row in rows},
    }
    text = sw.render_markdown(report)
    assert "| Assumption | What changed | Hit@3 per draw" in text
    assert "Manipulation check" in text
    assert "real-world next-ATM accuracy" in text
    assert "`timing_removed`" in text
    # The case-churn figure is computed from the draws, not written into the text.
    assert "on the other side of Hit@3" in text
    assert "4 of 20" in text
    # The conclusion is derived from the report, never hardcoded.
    assert "What this means" in text
    assert "No single broken assumption moves the serving ranker" in text
    # Single-draw rows must not be rendered as a range.
    assert "0.910" in text


def test_cache_never_reuses_a_draw_of_a_different_size(tmp_path, monkeypatch):
    """A cheap smoke world must not be served as the real 200k-row result."""
    import json as _json
    import pathlib

    monkeypatch.setattr(sw, "CACHE_DIR", str(tmp_path))
    config = sw.world_configs()[0]
    calls = []

    def fake_evaluate(cfg, holdout):
        calls.append(cfg["run_id"])
        row = _world_row(cfg["name"], cfg["kind"], cfg["seed"], 0.9)
        row["run_id"] = cfg["run_id"]
        return row

    monkeypatch.setattr(sw, "evaluate", fake_evaluate)
    sw._cached(config, {"RING-000000"})
    sw._cached(config, {"RING-000000"})
    assert len(calls) == 1  # second call came from the cache

    path = pathlib.Path(sw._cache_path(config))
    row = _json.loads(path.read_text())
    row.pop("n_transactions")
    path.write_text(_json.dumps(row))
    sw._cached(config, {"RING-000000"})
    assert len(calls) == 2  # unverifiable entries are redrawn


def test_ranker_rows_use_the_registry_they_are_given(rng_state):
    """A perturbed registry must not be silently replaced by the seed-42 one."""
    np.random.seed(42)
    atms, rows = small_world()
    candidates = gen.generate_candidate_lists(rows, atms, n_hard=2, n_easy=2)
    groups = set(list(candidates["group_id"].unique())[:5])
    plain = {a["atm_id"]: a for a in atms}

    np.random.seed(42)
    jittered = {a["atm_id"]: a for a in gen.generate_atms({"atm_jitter_m": 2000.0})}

    X_plain, *_ = tr.build_ranker_rows(rows, candidates, groups, atms=plain)
    X_moved, *_ = tr.build_ranker_rows(rows, candidates, groups, atms=jittered)
    assert len(X_plain) == len(X_moved) == 5 * 5
    assert not np.allclose(X_plain["distance_from_victim_km"],
                           X_moved["distance_from_victim_km"])
