"""Break one generator assumption at a time and re-score the frozen paths.

The evaluation in ``perturb_ranker.py`` moves the inputs of a fixed world. This
harness moves the world: it regenerates the 400-ATM registry, the 200k
transactions and the candidate lists with exactly one data-generating
assumption altered, then scores the shipped artifacts on the same 429 holdout
ring IDs. Nothing is retrained, so every delta is a transfer measurement —
"this model was fitted under assumption X; here is what it scores when X is
false".

Design: every knob is run at the same seeds as the unmodified generator, so each
draw is compared against the baseline world drawn from that seed and the
difference is the knob, not a different sample. Independent draws of the
unmodified generator give the spread that a delta has to clear. The unit of
comparison is the rate, not the case: each world plants a different ring ATM, so
a case ID is not the same unit in two draws (with identical assumptions the
draws already churn ~20% of cases between hit and miss).

Two frozen paths are scored, because the prototype ships two: the A2.1
pointwise ranker (what orders candidates at request time) and the row-ensemble
retrieval fallback. Synthetic data only.
"""
import argparse
import hashlib
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import joblib
import numpy as np
import pandas as pd

import generate_data as gen
import revalidate_model as rv
import train_ranker as tr
from ml_engine import METADATA_PATH, RANKER_PATH, load_models
from perturb_ranker import rank_metrics

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_PATH = os.path.join(BASE_DIR, "model", "assumption_report.json")
DOC_PATH = os.path.join(BASE_DIR, "..", "docs", "ASSUMPTION_SWEEP.md")
KS = (1, 3, 5)
HOLDOUT_SLICES = ("group_holdout", "time_holdout", "location_holdout")
N_TRANSACTIONS = 200000
# Knob worlds are re-drawn at each of these seeds, and compared with the
# baseline world drawn from the same seed.
SEEDS = (42, 7, 13)
# Independent draws of the unmodified generator: the spread a delta must clear.
CONTROL_SEEDS = (21, 34, 55)
BASELINE_SEEDS = tuple(sorted(set(SEEDS) | set(CONTROL_SEEDS)))
# Generated worlds are expensive (~45 s each) and deterministic, so each one is
# cached outside the repo and reused across runs.
CACHE_DIR = os.path.join(
    os.environ.get("TEMP", os.path.join(BASE_DIR, "..", ".cache")),
    "atlas-assumption-runs")

DEFAULT_POOL = {"n_hard": 6, "n_easy": 8}

# One entry per row of the table. ``assumptions`` is the single changed knob;
# pool sizes are counted as 1 true ATM plus ``n_hard`` nearest same-city
# negatives plus ``n_easy`` random ones.
KNOBS = [
    {"name": "timing_removed", "kind": "knob",
     "changed": "ring hours uniform over the day; evening terms dropped from the outcome logit",
     "assumptions": {"timing_coupling": False}},
    {"name": "ring_size_x2", "kind": "knob",
     "changed": "every crime type's mule_range doubled",
     "assumptions": {"ring_scale": 2.0}},
    {"name": "amount_wide", "kind": "knob",
     "changed": "loss amounts ~2x wider for both fraud and legitimate rows",
     "assumptions": {"amount_shape": "wide"}},
    {"name": "amount_flat", "kind": "knob",
     "changed": "one lognormal for every row; amount independent of crime type",
     "assumptions": {"amount_shape": "flat"}},
    {"name": "geography_jitter_250m", "kind": "knob",
     "changed": "every ATM coordinate moved by 250 m of Gaussian noise",
     "assumptions": {"atm_jitter_m": 250.0}},
    {"name": "geography_jitter_1000m", "kind": "knob",
     "changed": "every ATM coordinate moved by 1 km of Gaussian noise",
     "assumptions": {"atm_jitter_m": 1000.0}},
    {"name": "label_noise_5pct", "kind": "knob",
     "changed": "5% of drawn cash-out outcomes flipped before they enter ATM history",
     "assumptions": {"label_noise": 0.05}},
    {"name": "label_noise_10pct", "kind": "knob",
     "changed": "10% of drawn cash-out outcomes flipped before they enter ATM history",
     "assumptions": {"label_noise": 0.10}},
    {"name": "candidate_pool_5", "kind": "task", "chance_top3": 0.6,
     "changed": "5 candidates per case instead of 15 — a different task, not a broken assumption",
     "assumptions": {}, "n_hard": 2, "n_easy": 2},
    {"name": "candidate_pool_50", "kind": "task", "chance_top3": 0.06,
     "changed": "50 candidates per case instead of 15 — a different task, not a broken assumption",
     "assumptions": {}, "n_hard": 24, "n_easy": 25},
]

_MODELS = {}


def _load_models_once():
    if not _MODELS:
        rf, xgb = load_models()
        _MODELS["rf"], _MODELS["xgb"] = rf, xgb
        _MODELS["ranker"] = joblib.load(RANKER_PATH)
    return _MODELS


def holdout_ring_groups(metadata):
    """The 429 ring-case holdout from the shipped split provenance.

    Held fixed across every regenerated world so a delta measures the world, not
    a re-drawn split. The group IDs are positional (``RING-000000`` ..), so the
    same IDs exist in every world.
    """
    partitions = metadata["split_provenance"]["partitions"]
    groups = set()
    for name in HOLDOUT_SLICES:
        groups |= set(partitions[name]["group_ids"])
    return {g for g in groups if str(g).startswith("RING")}


def world_configs():
    """Every world to generate: the baseline at each seed, then each knob."""
    worlds = [
        {"run_id": f"baseline@{seed}", "name": "baseline", "kind": "baseline",
         "seed": seed, "changed": "the generator as shipped",
         "assumptions": {}, "chance_top3": None, **DEFAULT_POOL}
        for seed in BASELINE_SEEDS
    ]
    for knob in KNOBS:
        for seed in SEEDS:
            worlds.append({
                "run_id": f"{knob['name']}@{seed}",
                "name": knob["name"], "kind": knob["kind"], "seed": seed,
                "changed": knob["changed"], "assumptions": knob["assumptions"],
                "chance_top3": knob.get("chance_top3"),
                "n_hard": knob.get("n_hard", DEFAULT_POOL["n_hard"]),
                "n_easy": knob.get("n_easy", DEFAULT_POOL["n_easy"]),
            })
    return worlds


def build_world(config):
    """Regenerate registry, rows and candidate lists under one assumption set."""
    np.random.seed(int(config["seed"]))
    assumptions = gen._assumptions(config["assumptions"])
    atms = gen.generate_atms(assumptions)
    df = gen.generate_transactions(atms, n_transactions=N_TRANSACTIONS,
                                  assumptions=assumptions)
    candidates = gen.generate_candidate_lists(
        df, atms, n_hard=int(config["n_hard"]), n_easy=int(config["n_easy"]))
    return atms, df, candidates


def world_summary(df, candidates):
    """Manipulation check: proves the knob actually changed the drawn world."""
    rings = df[df["is_injected_fraud"]]
    per_case = candidates.groupby("case_id").size()
    return {
        "n_rings": int(candidates["case_id"].nunique()),
        "n_candidates_per_case": int(per_case.mode().iloc[0]),
        "cashout_rate": round(float(df["cash_out_occurred"].mean()), 4),
        "ring_evening_share": round(float(rings["hour"].between(17, 22).mean()), 4),
        "ring_mean_mules": round(float(rings["num_mule_accounts"].mean()), 2),
        "ring_mean_amount": round(float(rings["amount"].mean()), 1),
        "history_mean": round(float(df["atm_cashout_history"].mean()), 4),
    }


def rank_table(case_ids, labels, scores):
    """Per-case truth rank, keyed by case ID, with the same tie-breaking as
    ``perturb_ranker.rank_metrics`` so churn cannot drift from the rates."""
    table = {}
    for case_id in pd.unique(case_ids):
        rows = np.flatnonzero(case_ids == case_id)
        order = rows[np.argsort(-scores[rows], kind="stable")]
        table[str(case_id)] = int(np.where(labels[order] == 1)[0][0]) + 1
    return table


def evaluate(config, holdout_groups):
    models = _load_models_once()
    atms, df, candidates = build_world(config)
    atm_map = {a["atm_id"]: a for a in atms}

    X, labels, _, case_ids = tr.build_ranker_rows(
        df, candidates, holdout_groups, atms=atm_map)
    ranker_scores = models["ranker"].predict_proba(X)[:, 1]
    ranker_metrics = rank_metrics(case_ids, labels, ranker_scores, ks=KS)
    ranker_ranks = rank_table(case_ids, labels, ranker_scores)

    ensemble = rv.candidate_hit_at_k(
        df, candidates, None, models["rf"], models["xgb"], ks=KS,
        atms=atm_map, holdout_groups=holdout_groups, return_ranks=True)
    if ensemble.get("status") == "available_synthetic_only":
        ensemble_metrics = {
            "status": ensemble["status"],
            "n_cases": ensemble["n_cases"],
            "hit_rate": ensemble["hit_rate"],
            "mean_rank": ensemble["mean_rank"],
            "mrr": ensemble["mrr"],
        }
        ensemble_ranks = ensemble.pop("case_ranks")
    else:
        ensemble_metrics = {"status": ensemble.get("status"),
                            "reason": ensemble.get("reason")}
        ensemble_ranks = {}

    return {
        "run_id": config["run_id"],
        "name": config["name"],
        "kind": config["kind"],
        "changed": config["changed"],
        "seed": int(config["seed"]),
        "chance_top3": config.get("chance_top3"),
        "assumptions": gen._assumptions(config["assumptions"]),
        "world": world_summary(df, candidates),
        "serving_ranker": ranker_metrics,
        "ensemble": ensemble_metrics,
        "case_ranks": {"serving_ranker": ranker_ranks, "ensemble": ensemble_ranks},
    }


def _worker(payload):
    config, holdout_groups = payload
    return evaluate(config, holdout_groups)


def _cache_path(config):
    return os.path.join(CACHE_DIR, config["run_id"].replace("@", "_at_") + ".json")


def _cached(config, holdout_groups, refresh=False):
    path = _cache_path(config)
    if not refresh and os.path.exists(path):
        with open(path) as handle:
            row = json.load(handle)
        # A cached world is only reusable if it saw the same case set and the
        # same number of drawn rows (a cheap smoke run must never be mistaken
        # for a full one).
        if (row.get("holdout_size") == len(holdout_groups)
                and row.get("n_transactions") == N_TRANSACTIONS):
            return row
    row = evaluate(config, holdout_groups)
    row["holdout_size"] = len(holdout_groups)
    row["n_transactions"] = N_TRANSACTIONS
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(path, "w") as handle:
        json.dump(row, handle)
    return row


def two_se(hit_rate, n_cases):
    """Two standard errors of a Hit@3 rate, as a fraction."""
    if hit_rate is None or not n_cases:
        return None
    return round(2.0 * math.sqrt(hit_rate * (1.0 - hit_rate) / n_cases), 4)


def churn_against(rows, baseline_by_seed):
    """How many cases change retrieval outcome relative to the baseline world.

    Not a paired test: each world plants a different ring ATM, so a case ID is
    not the same unit. Each row is compared with the unmodified world drawn from
    the *same* seed, so the count is the knob's churn and not the draw's.
    """
    for key in ("serving_ranker", "ensemble"):
        for row in rows:
            baseline_row = baseline_by_seed.get(row["seed"])
            base = (baseline_row or {}).get("case_ranks", {}).get(key) or {}
            base_hit = {cid: rank <= 3 for cid, rank in base.items()}
            ranks = row["case_ranks"].get(key)
            if not base_hit or not ranks:
                row[f"{key}_churn"] = None
                continue
            changed = sum(
                1 for cid, hit in base_hit.items()
                if cid in ranks and (ranks[cid] <= 3) != hit
            )
            row[f"{key}_churn"] = {
                "changed": changed,
                "of": len(base_hit),
                "pct": round(100.0 * changed / len(base_hit), 1),
            }
    return rows


def _mean(values):
    return round(float(np.mean(values)), 4) if values else None


def aggregate(world_rows, anchor_seed=SEEDS[0]):
    """Fold the per-seed worlds into one row per assumption.

    The delta is computed per seed against the baseline world drawn from that
    same seed, then averaged: seed 42 alone would be one draw, and a knob has to
    be visible across all three.
    """
    baseline = {row["seed"]: row for row in world_rows if row["kind"] == "baseline"}
    by_name = {}
    for row in world_rows:
        if row["kind"] == "baseline":
            continue
        by_name.setdefault(row["name"], []).append(row)
    for rows in by_name.values():
        rows.sort(key=lambda row: row["seed"])

    table = []
    for name, rows in by_name.items():
        entry = {
            "name": name,
            "kind": rows[0]["kind"],
            "changed": rows[0]["changed"],
            "chance_top3": rows[0].get("chance_top3"),
            "seeds": [row["seed"] for row in rows],
            "n_rings": rows[0]["world"]["n_rings"],
            "house": {},
        }
        for key in ("serving_ranker", "ensemble"):
            hits, deltas, ranks, mrrs = [], [], [], []
            for row in rows:
                base = baseline.get(row["seed"])
                if row[key].get("status") != "available_synthetic_only" or not base:
                    continue
                hit = row[key]["hit_rate"]["top_3"]
                hits.append(hit)
                deltas.append(round(hit - base[key]["hit_rate"]["top_3"], 4))
                ranks.append(row[key]["mean_rank"])
                mrrs.append(row[key]["mrr"])
            entry[key] = {
                "hit_rates": hits,
                "deltas": deltas,
                "mean_hit_rate": _mean(hits),
                "mean_delta": _mean(deltas),
                "min_delta": min(deltas) if deltas else None,
                "max_delta": max(deltas) if deltas else None,
                "mean_rank": _mean(ranks),
                "mrr": _mean(mrrs),
                "n_cases": rows[0][key].get("n_cases"),
            }
        table.append(entry)

    anchor = baseline.get(anchor_seed) or baseline[max(baseline)]
    base_entry = {
        "name": "baseline", "kind": "baseline",
        "changed": "the generator as shipped", "chance_top3": None,
        "seeds": [anchor["seed"]], "n_rings": anchor["world"]["n_rings"],
        "house": {},
    }
    for key in ("serving_ranker", "ensemble"):
        # The baseline row must be the mean over the same seeds the knobs are
        # averaged over, or "Mean Hit@3" would compare 1 draw with 3.
        hits = [baseline[seed][key]["hit_rate"]["top_3"] for seed in SEEDS
                if seed in baseline
                and baseline[seed][key].get("status") == "available_synthetic_only"]
        base_entry[key] = {
            "hit_rates": hits,
            "deltas": [0.0] * len(hits),
            "mean_hit_rate": _mean(hits),
            "mean_delta": 0.0 if hits else None,
            "min_delta": 0.0 if hits else None,
            "max_delta": 0.0 if hits else None,
            "mean_rank": _mean([baseline[seed][key]["mean_rank"] for seed in SEEDS
                                if seed in baseline
                                and baseline[seed][key].get("status")
                                == "available_synthetic_only"]),
            "mrr": _mean([baseline[seed][key]["mrr"] for seed in SEEDS
                          if seed in baseline
                          and baseline[seed][key].get("status")
                          == "available_synthetic_only"]),
            "n_cases": anchor[key].get("n_cases"),
        }
    return [base_entry] + table


def cross_draw_churn(world_rows, anchor_seed=SEEDS[0]):
    """Case churn between two *unmodified* draws.

    This is the number that rules out a paired case-level test: the same case ID
    in two worlds is a different planted ATM, so it flips between hit and miss
    at a rate set by the draw, not by any assumption.
    """
    anchor = next((row for row in world_rows if row["kind"] == "baseline"
                   and row["seed"] == anchor_seed), None)
    rows = [row for row in world_rows if row["kind"] == "baseline"
            and row["seed"] != anchor_seed]
    if anchor is None or not rows:
        return None
    out = {}
    for key in ("serving_ranker", "ensemble"):
        base = anchor["case_ranks"].get(key) or {}
        base_hit = {cid: rank <= 3 for cid, rank in base.items()}
        counts = []
        for row in rows:
            ranks = row["case_ranks"].get(key) or {}
            counts.append(sum(1 for cid, hit in base_hit.items()
                              if cid in ranks and (ranks[cid] <= 3) != hit))
        if counts:
            out[key] = {
                "counts": counts, "of": len(base_hit),
                "min": min(counts), "max": max(counts),
                "min_pct": round(100.0 * min(counts) / len(base_hit), 1),
                "max_pct": round(100.0 * max(counts) / len(base_hit), 1),
            }
    return out


def control_spread(world_rows):
    """Spread of Hit@3 across independent draws of the unmodified generator."""
    rows = [row for row in world_rows if row["kind"] == "baseline"]
    out = {}
    for key in ("serving_ranker", "ensemble"):
        hits = [row[key]["hit_rate"]["top_3"] for row in rows
                if row[key].get("status") == "available_synthetic_only"]
        mean = _mean(hits)
        out[key] = {
            "seeds": [row["seed"] for row in rows],
            "hit_rates": hits,
            "mean": mean,
            "min": min(hits) if hits else None,
            "max": max(hits) if hits else None,
            "band": round(max(abs(h - mean) for h in hits), 4) if hits else None,
        }
    return out


def with_verdicts(table, spread):
    for entry in table:
        for key in ("serving_ranker", "ensemble"):
            stats = entry[key]
            if entry["kind"] == "baseline":
                entry[f"{key}_verdict"] = "baseline"
                continue
            if entry["kind"] == "task":
                entry[f"{key}_verdict"] = f"not comparable (chance {entry['chance_top3']:.3f})"
                continue
            band = spread[key]["band"]
            if band is None or stats["mean_delta"] is None:
                entry[f"{key}_verdict"] = "—"
            elif abs(stats["mean_delta"]) <= band:
                entry[f"{key}_verdict"] = f"within noise (±{band:.3f})"
            else:
                entry[f"{key}_verdict"] = f"beyond noise (±{band:.3f})"
    return table


def bounds(table, key):
    """Largest move any broken assumption produces, with its name."""
    knobs = [entry for entry in table if entry["kind"] == "knob"]
    if not knobs:
        return None
    worst = max(knobs, key=lambda entry: abs(entry[key]["mean_delta"]))
    return {"name": worst["name"], "delta": worst[key]["mean_delta"],
            "n_knobs": len(knobs)}


def _fmt(value, digits=3):
    return "—" if value is None else f"{value:.{digits}f}"


def _delta(value):
    return "—" if value is None else f"{value:+.3f}"


def _per_draw(values):
    return " / ".join(_fmt(value) for value in values) if values else "—"


def _table(lines, table, key, band, bounds_entry):
    lines += [
        "| Assumption | What changed | Hit@3 per draw | Mean Hit@3 | Mean Δ | Δ range | Verdict |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for entry in table:
        stats = entry[key]
        if stats["mean_hit_rate"] is None:
            lines.append(f"| `{entry['name']}` | {entry['changed']} | — | — | — | — | — |")
            continue
        spread = (_delta(stats["min_delta"]) + " to " + _delta(stats["max_delta"])
                  if len(stats["deltas"]) > 1 else _delta(stats["mean_delta"]))
        lines.append(
            f"| `{entry['name']}` | {entry['changed']} "
            f"| {_per_draw(stats['hit_rates'])} "
            f"| {_fmt(stats['mean_hit_rate'])} | {_delta(stats['mean_delta'])} "
            f"| {spread} | {entry[f'{key}_verdict']} |"
        )
    if bounds_entry:
        lines += [
            "",
            f"Largest mean move from any of the {bounds_entry['n_knobs']} broken "
            f"assumptions: {bounds_entry['delta']:+.3f} (`{bounds_entry['name']}`), "
            f"against a ±{band:.3f} band from independent draws.",
        ]


def render_markdown(report):
    table = report["configs"]
    spread = report["control_spread"]
    bands = report["noise_floor"]
    n = report["n_cases"]["serving_ranker"]
    seeds = "/".join(str(seed) for seed in SEEDS)
    worlds = report["worlds"]
    knobs = [entry for entry in table if entry["kind"] == "knob"]
    control = report.get("cross_draw_churn") or {}
    timing = next((entry for entry in table if entry["name"] == "timing_removed"), None)
    base_world = worlds.get(f"baseline@{SEEDS[0]}")
    if timing and base_world:
        tw = worlds[f"timing_removed@{SEEDS[0]}"]
        timing_note = (
            f"The timing row is the proof the knob bit: the ring evening share falls "
            f"from {base_world['ring_evening_share']:.3f} to "
            f"{tw['ring_evening_share']:.3f} while the ring count "
            f"({base_world['n_rings']} vs {tw['n_rings']}), mean mule count "
            f"({base_world['ring_mean_mules']:.2f} vs {tw['ring_mean_mules']:.2f}) and "
            f"mean amount ({base_world['ring_mean_amount']:.0f} vs "
            f"{tw['ring_mean_amount']:.0f}) are unchanged. The ring-size and label-noise "
            f"rows move their own column the same way, so no delta above is a mixture of "
            f"knob effect and a redrawn world."
        )
    else:
        timing_note = ""
    ranker_churn = control.get("serving_ranker")
    ensemble_churn = control.get("ensemble")
    if ranker_churn and ensemble_churn:
        control_note = (
            f"The unit of comparison is the rate, not the case. Two unmodified draws "
            f"already place {ranker_churn['min']}–{ranker_churn['max']} of "
            f"{ranker_churn['of']} ranker cases "
            f"({ranker_churn['min_pct']:.0f}–{ranker_churn['max_pct']:.0f}%) on the other "
            f"side of Hit@3, and {ensemble_churn['min']}–{ensemble_churn['max']} for the "
            f"ensemble, because each world plants a different ring ATM. A paired "
            f"case-level test would measure the draw rather than the assumption, which is "
            f"why every verdict is read off the rate."
        )
    else:
        control_note = "The unit of comparison is the rate, not the case."
    lines = [
        "# Generator assumption sweep",
        "",
        "One data-generating assumption is broken at a time, the world is regenerated",
        "from `backend/generate_data.py`, and the two shipped retrieval paths are scored",
        "on the same holdout ring IDs. Nothing is retrained: each number is what a model",
        "fitted under the original assumptions scores when that assumption is false.",
        "",
        f"{n} holdout ring-cases per world. Every assumption is drawn at three seeds",
        f"({seeds}) and compared with the *unmodified* generator at the same seed, so the",
        "delta is the knob and not a different sample; the mean over the three draws is",
        "what the table reports.",
        "",
        f"Independent draws of the unmodified generator scored ranker Hit@3 "
        f"{spread['serving_ranker']['min']:.3f}–{spread['serving_ranker']['max']:.3f} "
        f"and ensemble Hit@3 {spread['ensemble']['min']:.3f}–"
        f"{spread['ensemble']['max']:.3f} across "
        f"{len(spread['serving_ranker']['seeds'])} seeds. That spread sets the band "
        f"(±{bands['serving_ranker']:.3f} ranker, ±{bands['ensemble']:.3f} ensemble); a "
        "knob inside it is not evidence of a dependence, and one outside it is.",
        "",
        control_note,
        "",
        "## Serving ranker (A2.1, what orders candidates at request time)",
        "",
    ]
    _table(lines, table, "serving_ranker", bands["serving_ranker"],
           report["bounds"]["serving_ranker"])
    lines += [
        "",
        f"Two standard errors of the baseline Hit@3 (n={n}) is "
        f"{report['two_se']['serving_ranker']}.",
        "",
        "## Row-ensemble retrieval (fallback when the ranker artifact is absent)",
        "",
    ]
    _table(lines, table, "ensemble", bands["ensemble"], report["bounds"]["ensemble"])
    lines += [
        "",
        f"Two standard errors of the baseline Hit@3 (n={n}) is "
        f"{report['two_se']['ensemble']}.",
        "",
        "## Manipulation check (the world moved, at seed 42)",
        "",
        "| Assumption | Rings | Candidates/case | Cash-out rate | Ring rows 17-22 | Mean mules | Mean amount | Mean ATM history |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for entry in table:
        world = worlds.get(f"{entry['name']}@{SEEDS[0]}")
        if world is None:
            continue
        lines.append(
            f"| `{entry['name']}` | {world['n_rings']} | {world['n_candidates_per_case']} "
            f"| {world['cashout_rate']:.4f} | {world['ring_evening_share']:.3f} "
            f"| {world['ring_mean_mules']:.2f} | {world['ring_mean_amount']:.0f} "
            f"| {world['history_mean']:.4f} |"
        )
    lines += [
        "",
        timing_note,
        "",
        "## What this means",
        "",
    ]
    knobs = [entry for entry in table if entry["kind"] == "knob"]
    for key, label in (("serving_ranker", "serving ranker"),
                       ("ensemble", "ensemble fallback")):
        stats = report["bounds"][key]
        band = bands[key]
        beyond = [entry for entry in knobs
                  if entry[key]["mean_delta"] is not None
                  and abs(entry[key]["mean_delta"]) > band]
        if stats is None:
            continue
        if beyond:
            named = "; ".join(
                f"`{entry['name']}` {_delta(entry[key]['mean_delta'])}"
                for entry in beyond)
            lines.append(
                f"{len(beyond)} of {len(knobs)} broken assumptions move the {label}'s "
                f"Hit@3 beyond the control band (±{band:.3f}): {named}."
            )
        else:
            lines.append(
                f"No single broken assumption moves the {label}'s Hit@3 beyond the "
                f"control band. The largest mean move is {_delta(stats['delta'])} "
                f"(`{stats['name']}`) against a ±{band:.3f} band."
            )
        lines.append("")
    lines += [
        "That is a bound, not an all-clear. The serving ranker's nine features are all",
        "ATM-varying, so a case-level assumption can only reach it through",
        "`atm_cashout_history` — a knob that leaves that column alone cannot move the",
        "ranking in principle, and the columns each knob touches are listed in the",
        "manipulation table above. What the sweep rules out is large sensitivity to these",
        f"{len(knobs)} settings; it does not show that no assumption anywhere matters, and",
        "it says nothing about real ATMs.",
        "",
        "## Scope",
        "",
        "These numbers describe a simulator and a frozen synthetic model. They bound how",
        "far the retrieval score moves when a generator assumption is false; they are not",
        "real-world next-ATM accuracy, not a calibration statement, and no probability is",
        "attached to any of them. The candidate-pool rows are a harder or easier task, not",
        "a broken assumption, and are labelled as such.",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", default=REPORT_PATH)
    parser.add_argument("--markdown", default=DOC_PATH)
    parser.add_argument("--refresh", action="store_true",
                        help="ignore the generated-world cache and redraw")
    parser.add_argument("--only", default="", help="comma-separated assumption names")
    parser.add_argument("--world", default="",
                        help="evaluate one run id (e.g. timing_removed@7) and exit")
    parser.add_argument("--render-only", action="store_true",
                        help="rebuild the JSON and markdown from cached worlds")
    parser.add_argument("--no-write", action="store_true")
    args = parser.parse_args()

    with open(METADATA_PATH) as handle:
        metadata = json.load(handle)
    if not metadata.get("split_provenance"):
        raise SystemExit("Frozen artifacts lack split provenance; no holdout cases")
    holdout = holdout_ring_groups(metadata)
    if not holdout:
        raise SystemExit("No holdout ring-cases in the frozen split provenance")

    if args.world:
        # One world per process: a long serial run fragments and slows down on
        # a small machine, and this costs only the model load (~20 s).
        matches = [c for c in world_configs() if c["run_id"] == args.world]
        if not matches:
            raise SystemExit(f"unknown world {args.world}")
        row = _cached(matches[0], holdout, refresh=args.refresh)
        print(f"  {row['run_id']:34s} ranker Hit@3 "
              f"{_fmt(row['serving_ranker'].get('hit_rate', {}).get('top_3'))} | "
              f"ensemble Hit@3 {_fmt(row['ensemble'].get('hit_rate', {}).get('top_3'))}")
        return

    configs = world_configs()
    if args.only:
        wanted = {name.strip() for name in args.only.split(",") if name.strip()}
        configs = [c for c in configs
                   if c["name"] in wanted or c["kind"] == "baseline"]
        if not any(c["kind"] != "baseline" for c in configs):
            raise SystemExit(f"no assumption matched {sorted(wanted)}")

    print(f"{len(configs)} worlds x {N_TRANSACTIONS:,} rows, "
          f"{len(holdout)} holdout ring-cases each")
    world_rows = []
    if args.render_only:
        # Rebuild the report without touching the generator: useful for wording
        # changes once the expensive worlds are cached.
        for config in configs:
            path = _cache_path(config)
            if not os.path.exists(path):
                raise SystemExit(f"no cached world at {path}; run without "
                                 f"--render-only to draw it")
            with open(path) as handle:
                world_rows.append(json.load(handle))
        print(f"reused {len(world_rows)} cached worlds")
    else:
        for config in configs:
            row = _cached(config, holdout, refresh=args.refresh)
            world_rows.append(row)
            print(f"  {row['run_id']:34s} ranker Hit@3 "
                  f"{_fmt(row['serving_ranker'].get('hit_rate', {}).get('top_3'))} | "
                  f"ensemble Hit@3 {_fmt(row['ensemble'].get('hit_rate', {}).get('top_3'))}",
                  flush=True)

    baseline_rows = [row for row in world_rows if row["kind"] == "baseline"]
    if not baseline_rows:
        raise SystemExit("baseline world missing; cannot compute deltas")
    anchor = next((row for row in baseline_rows if row["seed"] == SEEDS[0]),
                  baseline_rows[0])
    world_rows = churn_against(world_rows, {row["seed"]: row for row in baseline_rows})

    table = with_verdicts(aggregate(world_rows), control_spread(world_rows))
    spread = control_spread(world_rows)
    floor = {key: spread[key]["band"] for key in ("serving_ranker", "ensemble")}

    report = {
        "protocol": "one-assumption-at-a-time generator sweep, frozen artifacts",
        "status": "available_synthetic_only",
        "retrained": False,
        "n_transactions": N_TRANSACTIONS,
        "seeds": list(SEEDS),
        "control_seeds": list(CONTROL_SEEDS),
        "n_cases": {key: anchor[key].get("n_cases")
                    for key in ("serving_ranker", "ensemble")},
        "two_se": {key: two_se(anchor[key]["hit_rate"]["top_3"],
                               anchor[key].get("n_cases"))
                   for key in ("serving_ranker", "ensemble")},
        "noise_floor": floor,
        "noise_floor_method": "largest absolute deviation of the unmodified generator's "
                              "Hit@3 across independent seeds",
        "control_spread": spread,
        "cross_draw_churn": cross_draw_churn(world_rows),
        "bounds": {key: bounds(table, key) for key in ("serving_ranker", "ensemble")},
        "holdout_groups_sha256": hashlib.sha256(
            json.dumps(sorted(holdout)).encode()).hexdigest(),
        "note": "Synthetic only. Measures transfer of frozen artifacts to a world "
                "regenerated without one generative assumption; not real-world "
                "next-ATM accuracy and not a calibration or probability statement.",
        "configs": table,
        "worlds": {row["run_id"]: row["world"] for row in world_rows},
        "churn": {row["run_id"]: {
            "serving_ranker": row.get("serving_ranker_churn"),
            "ensemble": row.get("ensemble_churn")} for row in world_rows},
    }

    for entry in table:
        print(
            f"{entry['name']:24s} ranker {_fmt(entry['serving_ranker']['mean_hit_rate'])} "
            f"({_delta(entry['serving_ranker']['mean_delta'])}) | "
            f"ensemble {_fmt(entry['ensemble']['mean_hit_rate'])} "
            f"({_delta(entry['ensemble']['mean_delta'])})"
        )

    if not args.no_write:
        os.makedirs(os.path.dirname(args.json), exist_ok=True)
        os.makedirs(os.path.dirname(args.markdown), exist_ok=True)
        with open(args.json, "w") as handle:
            json.dump(report, handle, indent=2)
        with open(args.markdown, "w", encoding="utf-8") as handle:
            handle.write(render_markdown(report))
        print(f"wrote {args.json}")
        print(f"wrote {args.markdown}")


if __name__ == "__main__":
    main()
