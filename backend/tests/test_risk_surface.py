"""The risk surface must be explainable, not decorative.

A judge will ask two things about a coloured hexagon: where does the number come
from, and why is *this* hex hot? These tests pin both. They also pin the things
that are easy to get subtly wrong and impossible to see on screen - a Euclidean
distance in degrees, a normalised mean with no reach limit, or bands borrowed
from the row model's thresholds.

Run from backend/:  python -m pytest tests/test_risk_surface.py -q
"""
import math

import h3
import pytest

import risk_surface as rs


# -- distances -----------------------------------------------------------------

def test_haversine_matches_a_known_meridian_arc():
    # One degree of latitude is ~111.19 km everywhere.
    assert rs.haversine_m(0.0, 0.0, 1.0, 0.0) == pytest.approx(111_195, abs=150)


def test_haversine_is_symmetric():
    a = rs.haversine_m(11.94, 79.80, 13.08, 80.27)
    b = rs.haversine_m(13.08, 80.27, 11.94, 79.80)
    assert a == pytest.approx(b, rel=1e-12)


def test_haversine_shrinks_longitude_with_latitude():
    """A degree of longitude is 111 km at the equator, ~96 km at Chennai.

    Scoring in raw degrees would make the same offset worth more at the poles
    than the equator, which is the bug this function exists to avoid.
    """
    equator = rs.haversine_m(0.0, 0.0, 0.0, 1.0)
    chennai = rs.haversine_m(13.08, 80.0, 13.08, 81.0)
    assert chennai < equator
    assert chennai == pytest.approx(equator * math.cos(math.radians(13.08)), rel=2e-3)


# -- kernel --------------------------------------------------------------------

def test_gaussian_weight_peaks_at_one_and_falls_off():
    assert rs.gaussian_weight(0.0, 800.0) == pytest.approx(1.0)
    assert rs.gaussian_weight(800.0, 800.0) == pytest.approx(math.exp(-0.5))
    assert rs.gaussian_weight(1600.0, 800.0) < rs.gaussian_weight(800.0, 800.0)
    assert rs.gaussian_weight(10.0, 0.0) == 0.0


# -- reach: a normalised mean has no sense of "too far" --------------------------

def test_cell_far_from_every_atm_reports_no_coverage():
    """Two km of padding around a lone ATM must stay empty.

    With only normalised weights, a cell 2.7 km from the only ATM still scores
    ~77 because the weights cancel in the division. Drawing that as a hotspot
    would invent risk where nothing was assessed.
    """
    points = [{"id": "A1", "lat": 11.94, "lng": 79.80, "score": 0.9}]
    surface = rs.build_surface(points, pad_m=3000.0)
    far = [c for c in surface["cells"] if c["nearest_m"] and c["nearest_m"] > 1600.0]
    assert far, "padding should produce cells beyond the reach"
    assert all(c["score"] is None for c in far)
    assert all(c["level"] == "none" for c in far)


def test_reach_is_two_sigma_and_is_reported():
    surface = rs.build_surface(
        [{"id": "A1", "lat": 11.94, "lng": 79.80, "score": 0.9}], sigma_m=600.0
    )
    assert surface["reach_m"] == pytest.approx(1200.0)


def test_the_atms_own_cell_is_scored_and_contains_the_atm():
    points = [{"id": "A1", "lat": 11.94, "lng": 79.80, "score": 0.8}]
    surface = rs.build_surface(points, pad_m=1500.0)
    own = h3.latlng_to_cell(11.94, 79.80, rs.RESOLUTION_DEFAULT)
    cell = next(c for c in surface["cells"] if c["h3"] == own)
    assert cell["score"] == pytest.approx(80.0, abs=0.5)
    assert cell["atm_count"] == 1
    assert cell["top_atm"] == "A1"


def test_empty_input_returns_an_empty_surface():
    surface = rs.build_surface([])
    assert surface["cells"] == []
    assert surface["summary"]["cells"] == 0
    assert surface["summary"]["scored"] == 0


# -- bands are relative, never the row model's thresholds ------------------------

def test_bands_are_quantiles_of_this_citys_cells():
    """Two identical geometries scored on different scales must band together.

    The row model's 70/45 cuts mean nothing for an uncalibrated relevance score;
    using them would paint a whole city red at one scale and blue at another.
    """
    geometry = [
        {"id": "A1", "lat": 11.94, "lng": 79.80},
        {"id": "A2", "lat": 11.96, "lng": 79.82},
        {"id": "A3", "lat": 11.92, "lng": 79.78},
    ]
    low = rs.build_surface([{**p, "score": 0.10} for p in geometry])
    high = rs.build_surface([{**p, "score": 0.90} for p in geometry])

    # Flat fields: every scored cell is equal, so the priority band must also
    # hold every cell rather than a constant 70.
    assert low["bands"]["priority_at"] == pytest.approx(10.0, abs=0.1)
    assert high["bands"]["priority_at"] == pytest.approx(90.0, abs=0.1)


def test_priority_band_is_high_and_watch_band_is_lower():
    points = [
        {"id": f"A{i}", "lat": 11.90 + 0.004 * i, "lng": 79.80 + 0.004 * i, "score": i / 10.0}
        for i in range(10)
    ]
    surface = rs.build_surface(points, pad_m=1500.0)
    assert surface["bands"]["priority_at"] >= surface["bands"]["watch_at"]
    scored = surface["summary"]["scored"]
    assert 1 <= surface["summary"]["priority"] <= max(2, round(0.30 * scored))


def test_summary_counts_account_for_every_cell():
    points = [
        {"id": "A1", "lat": 11.94, "lng": 79.80, "score": 0.9},
        {"id": "A2", "lat": 11.96, "lng": 79.82, "score": 0.2},
    ]
    surface = rs.build_surface(points, pad_m=2000.0)
    s = surface["summary"]
    assert s["cells"] == len(surface["cells"])
    assert s["priority"] + s["watch"] + s["background"] <= s["scored"]
    assert s["scored"] == sum(1 for c in surface["cells"] if c["score"] is not None)
    assert s["cells"] - s["scored"] == sum(1 for c in surface["cells"] if c["level"] == "none")


# -- which score drives it -------------------------------------------------------

def test_surface_prefers_ranker_score_over_row_model_score():
    """risk_score saturates: every ATM measured 74-99 regardless of rank.

    If the surface were built from it the whole city would be one colour, so the
    adapter must take ranker_score when it exists.
    """
    ranked = [
        {"atm_id": "A1", "latitude": 11.94, "longitude": 79.80,
         "risk_score": 75.0, "ranker_score": 0.90},
        {"atm_id": "A2", "latitude": 11.96, "longitude": 79.82,
         "risk_score": 99.0, "ranker_score": 0.05},
    ]
    points = rs.points_from_ranked(ranked)
    by_id = {p["id"]: p["score"] for p in points}
    assert by_id["A1"] == pytest.approx(0.90)
    assert by_id["A2"] == pytest.approx(0.05)

    surface = rs.build_for_ranked(ranked)
    assert surface["basis"] == "ranker_score"


def test_fallback_basis_is_declared_when_no_ranker_score_exists():
    ranked = [
        {"atm_id": "A1", "latitude": 11.94, "longitude": 79.80, "risk_score": 80.0},
        {"atm_id": "A2", "latitude": 11.96, "longitude": 79.82, "risk_score": 40.0},
    ]
    surface = rs.build_for_ranked(ranked)
    assert surface["basis"] == "risk_score"
    assert "do not order this list" in surface["note"]


def test_locations_without_coordinates_are_skipped():
    ranked = [
        {"atm_id": "A1", "latitude": None, "longitude": None, "ranker_score": 0.9},
        {"atm_id": "A2", "latitude": 11.96, "longitude": 79.82, "ranker_score": 0.4},
    ]
    assert [p["id"] for p in rs.points_from_ranked(ranked)] == ["A2"]


# -- the hotspot must survive the bandwidth choice -------------------------------

def test_top_hotspot_holds_across_bandwidths():
    """The displayed hotspot must not be an artifact of the chosen sigma.

    One clearly dominant ATM among weaker neighbours: at 600 m the kernel is
    tight and at 1000 m it is wide, but the hottest cell has to stay the one
    next to the dominant ATM either way.
    """
    dominant = {"id": "HOT", "lat": 11.9400, "lng": 79.8000, "score": 0.95}
    others = [
        {"id": f"L{i}", "lat": 11.9400 + 0.012 * math.cos(i), "lng": 79.8000 + 0.012 * math.sin(i),
         "score": 0.05}
        for i in range(6)
    ]
    top_cells = []
    for sigma in (600.0, 800.0, 1000.0):
        surface = rs.build_surface([dominant, *others], sigma_m=sigma)
        top = next(c for c in surface["cells"] if c["score"] is not None)
        top_cells.append(top["h3"])
        assert top["top_atm"] == "HOT"
    assert len(set(top_cells)) == 1, f"hotspot moved with bandwidth: {top_cells}"


# -- parameter guards ------------------------------------------------------------

def test_resolution_and_sigma_are_clamped_to_the_served_range():
    points = [{"id": "A1", "lat": 11.94, "lng": 79.80, "score": 0.9}]
    coarse = rs.build_surface(points, resolution=3)
    fine = rs.build_surface(points, resolution=15)
    assert coarse["resolution"] == rs.RESOLUTION_MIN
    assert fine["resolution"] == rs.RESOLUTION_MAX

    tight = rs.build_surface(points, sigma_m=1.0)
    wide = rs.build_surface(points, sigma_m=99_999.0)
    assert tight["sigma_m"] == rs.SIGMA_M_MIN
    assert wide["sigma_m"] == rs.SIGMA_M_MAX


def test_cell_boundaries_are_polygons_that_contain_their_center():
    surface = rs.build_surface(
        [{"id": "A1", "lat": 11.94, "lng": 79.80, "score": 0.9}], pad_m=1200.0
    )
    for cell in surface["cells"]:
        assert len(cell["boundary"]) == 6
        lats = [p[0] for p in cell["boundary"]]
        lngs = [p[1] for p in cell["boundary"]]
        assert min(lats) <= cell["center"][0] <= max(lats)
        assert min(lngs) <= cell["center"][1] <= max(lngs)


def test_payload_declares_it_is_not_calibrated():
    surface = rs.build_surface(
        [{"id": "A1", "lat": 11.94, "lng": 79.80, "score": 0.9}], pad_m=1200.0
    )
    assert surface["calibrated"] is False
    assert surface["basis"] == "ranker_score"
    assert "not probabilities" in surface["note"].lower() or "not probabilities" in surface["note"]
    assert surface["cell_edge_m"] > 0
