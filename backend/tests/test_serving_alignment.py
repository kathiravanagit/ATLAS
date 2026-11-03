"""Serving features must stay inside the distribution the artifacts were fitted on.

Phase 3.1 found two serving-side causes:

* the synthetic victim sat at the city centre, while training always placed it
  within a few km of the registry ATM the transaction used. On Hyderabad that
  put every ATM outside the ranker's positive region, and the surface collapsed
  to one flat band;
* ATM type and crime density came from case-id hashes, not the registry, and
  the model inputs used the case's full linked-account count.

These tests pin the alignment: geometry near a registry ATM, registry-driven ATM
attributes, and mule/frequency values the model has seen.
"""
import math

import pytest

from city_data import CITIES
from risk_surface import FLAT_EPS
import main
from models_db import AtmLocation, Case
from tests.conftest import TestingSessionLocal

TRAINED_TYPE_SCORES = {0.4, 0.6, 0.7, 0.8, 1.0}


@pytest.fixture
def demo_city_cases():
    """One case per demo city, scored against the full 64-ATM registry."""
    with TestingSessionLocal() as db:
        db.add_all([
            AtmLocation(atm_id=atm["id"], name=atm["name"], latitude=atm["lat"],
                        longitude=atm["lng"], area=atm["name"])
            for city in CITIES.values() for atm in city["atms"]
        ])
        db.add_all([
            Case(case_id=f"ALIGN-{city_id.upper()}", crime_type="UPI Fraud",
                 amount=48000, linked_accounts=3, current_risk="Medium",
                 status="active", victim_name="Alignment Victim",
                 contact="+91-0000000000", description=f"alignment probe {city_id}",
                 district=city["district"])
            for city_id, city in CITIES.items()
        ])
        db.commit()
    yield


def _predictions(city_id):
    with TestingSessionLocal() as db:
        return main.get_predictions_for_case(f"ALIGN-{city_id.upper()}", db)


def test_every_demo_city_surface_still_separates_cells(demo_city_cases):
    if main.ml_engine.get_ranker() is None:
        pytest.skip("ranker artifact absent")
    flat = []
    for city_id in CITIES:
        surface = _predictions(city_id)["risk_surface"]
        spread = surface["summary"]["priority"] + surface["summary"]["watch"]
        if surface["flat"] or spread == 0:
            flat.append(city_id)
    assert flat == [], f"flat or unbanded surfaces: {flat}"


def test_victim_anchor_keeps_the_nearest_atm_inside_the_trained_region(demo_city_cases):
    for city_id in CITIES:
        features = [row["prediction_features"]
                    for row in _predictions(city_id)["ranked_locations"]]
        nearest = min(row["distance_from_victim_km"] for row in features)
        closest_prox = max(row["proximity_score"] for row in features)
        # Training fraud victim-ATM distance: p05 0.39 km, p50 1.43 km. The
        # anchor offset is 0.4-1.6 km, so the nearest registry ATM cannot be
        # further than that plus rounding.
        assert nearest <= 1.7, (city_id, nearest)
        assert closest_prox >= 0.75, (city_id, closest_prox)


def test_served_features_use_registry_atm_attributes_and_in_support_values(demo_city_cases):
    for city_id in CITIES:
        for row in _predictions(city_id)["ranked_locations"]:
            f = row["prediction_features"]
            assert f["atm_type_score"] in TRAINED_TYPE_SCORES, (city_id, f["atm_type_score"])
            assert 1 <= f["historical_crime_density"] <= 20, (city_id, f["historical_crime_density"])
            assert 1 <= f["num_mule_accounts"] <= 8, (city_id, f["num_mule_accounts"])
            assert 0 <= f["hour"] <= 23, (city_id, f["hour"])
            assert f["time_window_match"] == (1.0 if 17 <= f["hour"] <= 22 else 0.0)
            assert 0.0 <= f["recent_withdrawal_freq"] <= 1.0
            assert f["transaction_velocity"] == round(min(f["num_mule_accounts"] / 6, 1.0), 3)


def test_circular_hour_does_not_pull_a_midnight_window_to_noon():
    # Arithmetic mean of 23 and 01 is 12; on the clock it is midnight.
    assert main._circular_hour([23, 1]) == 0
    assert main._circular_hour([17, 18, 19]) == 18
    assert main._circular_hour([22, 23, 0]) == 23
    assert main._circular_hour([]) == 18  # no records: a neutral evening hour


def test_offset_point_lands_at_the_requested_distance():
    lat, lng = 11.94, 79.81
    for bearing in (0, 90, 180, 270):
        moved = main._offset_point(lat, lng, bearing, 1.0)
        assert main.haversine(lat, lng, *moved) == pytest.approx(1.0, abs=0.01)
    assert math.isfinite(main._offset_point(lat, lng, 45, 1.6)[0])
