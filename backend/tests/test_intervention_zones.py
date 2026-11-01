"""DBSCAN intervention zones: adjacency, exclusions and payload shape.

The clustering has to happen on the H3 graph, not on lat/lng, so most of these
tests build real neighbouring cells with `h3.grid_disk` and assert that the
zones follow cell adjacency rather than raw distance.
"""
from __future__ import annotations

import h3
import pytest

import intervention_zones as iz

BASE = h3.latlng_to_cell(11.94, 79.80, 8)
FAR = h3.latlng_to_cell(11.98, 79.85, 8)  # ~6 km away: never adjacent to BASE


def _cells(origin: str, radius: int) -> list[str]:
    return list(h3.grid_disk(origin, radius))


def _cell(cell_id: str, level: str = "priority", score: float | None = 50.0,
          atm_count: int = 0, top_atm: str = "ATM-1") -> dict:
    lat, lng = h3.cell_to_latlng(cell_id)
    return {
        "h3": cell_id,
        "level": level,
        "score": score,
        "center": [round(lat, 6), round(lng, 6)],
        "boundary": [[round(a, 6), round(b, 6)] for a, b in h3.cell_to_boundary(cell_id)],
        "atm_count": atm_count,
        "top_atm": top_atm,
    }


def _surface(cells: list[dict]) -> dict:
    return {"cells": cells}


# -- what gets clustered ---------------------------------------------------------

def test_two_separated_blobs_become_two_zones():
    left = [_cell(c) for c in _cells(BASE, 1)]
    right = [_cell(c) for c in _cells(FAR, 1)]
    # Guard the fixture against accidental adjacency between the blobs.
    assert not (set(h3.grid_disk(BASE, 2)) & set(c["h3"] for c in right))

    result = iz.build_zones(_surface(left + right))

    assert result["summary"]["zones"] == 2
    assert sorted(z["cells"] for z in result["zones"]) == [len(left), len(right)]
    assert result["summary"]["clustered_cells"] == len(left) + len(right)
    assert result["summary"]["noise_cells"] == 0


def test_cells_one_ring_apart_do_not_merge_at_eps_one():
    """A gap of a single cell separates two zones unless eps hops across it."""
    blob = [_cell(c) for c in _cells(BASE, 1)]
    # A cell four rings out, so its own blob starts three rings from BASE and the
    # two are two hops apart: outside eps=1, inside eps=2.
    far = next(iter(h3.grid_ring(BASE, 4)))
    far_blob = [_cell(c) for c in _cells(far, 1)]

    separated = iz.build_zones(_surface(blob + far_blob), eps_hops=1)
    bridged = iz.build_zones(_surface(blob + far_blob), eps_hops=2)

    assert separated["summary"]["zones"] == 2
    # Two hops reach across one empty cell, which is exactly the case eps 2 exists
    # for: one missed cell in the middle of a hot area must not split the zone.
    assert bridged["summary"]["zones"] == 1
    assert bridged["summary"]["clustered_cells"] == len(blob) + len(far_blob)


def test_unscored_and_none_cells_are_never_clustered():
    """`none` means no ATM in reach, not "safe", and 2-sigma padding must not count."""
    real = [_cell(c) for c in _cells(BASE, 1)]
    padding = [
        _cell(c, level="none", score=None)
        for c in _cells(BASE, 3)
        if not (set(h3.grid_disk(c, 1)) & {x["h3"] for x in real})
    ]
    result = iz.build_zones(_surface(real + padding))

    clustered = {c for z in result["zones"] for c in z["h3_cells"]}
    assert clustered == {c["h3"] for c in real}
    assert result["summary"]["zones"] == 1
    assert result["summary"]["noise_cells"] == 0


def test_background_cells_are_not_clustered():
    """A cluster of background cells is not an intervention zone."""
    result = iz.build_zones(_surface([_cell(c, level="background", score=3.0)
                                      for c in _cells(BASE, 2)]))
    assert result["summary"]["zones"] == 0
    assert result["summary"]["clustered_cells"] == 0


def test_min_samples_turns_a_pair_into_noise():
    pair = [_cell(c) for c in _cells(BASE, 0)] + [_cell(c) for c in _cells(FAR, 0)]
    one = iz.build_zones(_surface([pair[0]]), min_samples=3)
    assert one["summary"]["zones"] == 0
    assert one["summary"]["noise_cells"] == 1

    bound = iz.build_zones(_surface([pair[0]]), min_samples=1)
    assert bound["summary"]["zones"] == 1


def test_too_few_clusterable_cells_returns_an_empty_payload():
    result = iz.build_zones(_surface([_cell(BASE)]))
    assert result["zones"] == []
    assert result["summary"]["zones"] == 0
    assert result["summary"]["priority_cells"] == 1
    assert result["method"] == "DBSCAN on H3 k-ring adjacency"


# -- zone content ----------------------------------------------------------------

def test_zone_summary_tracks_priority_watch_mix_and_top_atm():
    hot = set(_cells(BASE, 1))
    outer = [c for c in _cells(BASE, 2) if c not in hot]
    cells = [_cell(c, level="priority", score=60.0, atm_count=1, top_atm="HOT") for c in hot]
    cells += [_cell(c, level="watch", score=20.0, atm_count=0, top_atm="COOL") for c in outer]

    result = iz.build_zones(_surface(cells))
    assert result["summary"]["zones"] == 1
    zone = result["zones"][0]
    assert zone["level"] == "priority"
    assert zone["priority_cells"] == 7
    assert zone["watch_cells"] == len(outer)
    assert zone["score_max"] == pytest.approx(60.0)
    assert zone["top_atm"] == "HOT"
    assert zone["atm_count"] == 7


def test_hull_contains_every_member_centre():
    blob = [_cell(c) for c in _cells(BASE, 2)]
    zone = iz.build_zones(_surface(blob))["zones"][0]
    ring = zone["boundary"]
    assert len(ring) >= 3

    def inside(point, polygon):
        """Ray casting on the closed ring; the ring is not self-intersecting."""
        x, y = point
        hit = False
        for i in range(len(polygon)):
            x1, y1 = polygon[i]
            x2, y2 = polygon[(i + 1) % len(polygon)]
            if (y1 > y) != (y2 > y):
                xin = (x2 - x1) * (y - y1) / (y2 - y1) + x1
                if x < xin:
                    hit = not hit
        return hit

    for cell in blob:
        assert inside(tuple(cell["center"]), [tuple(p) for p in ring]), cell["h3"]


def test_zones_are_ordered_priority_first_then_by_mean_score():
    """A deployment list that is not ordered is not a deployment list."""
    hot = [_cell(c, level="priority", score=90.0) for c in _cells(BASE, 1)]
    warm = [_cell(c, level="watch", score=40.0) for c in _cells(FAR, 1)]

    result = iz.build_zones(_surface(hot + warm))
    assert [z["zone_id"] for z in result["zones"]] == ["Z1", "Z2"]
    assert result["zones"][0]["level"] == "priority"
    assert result["zones"][0]["score_mean"] > result["zones"][1]["score_mean"]


def test_payload_carries_the_no_probability_disclaimer():
    zone = iz.build_zones(_surface([_cell(c) for c in _cells(BASE, 1)]))
    assert "not a predicted crime location" in zone["note"]
    assert zone["eps_hops"] == iz.EPS_HOPS_DEFAULT
    assert zone["min_samples"] == iz.MIN_SAMPLES_DEFAULT
