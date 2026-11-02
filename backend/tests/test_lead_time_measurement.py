"""Protocol guards for the Phase 2 lead-time measurement.

The measurement is negative, so the risk is that a later change quietly feeds the
label hour back into the features and turns it positive. These tests pin the two
ways that could happen: a derived column entering the feature list, and the
evening rotation being dropped.
"""
import pandas as pd

from measure_lead_time import (
    CATEGORICAL_FEATURES,
    LABEL_DERIVED,
    NUMERIC_FEATURES,
    first_cash_out_hour,
    rings_from_frame,
)


def _row(group_id, hour, cash_out, amount=10000.0, crime_type="UPI Fraud"):
    row = {column: 1.0 for column in NUMERIC_FEATURES}
    row.update({
        "group_id": group_id,
        "hour": hour,
        "cash_out_occurred": 1 if cash_out else 0,
        "is_injected_fraud": True,
        "amount": amount,
        "crime_type": crime_type,
        "city": "chennai",
    })
    return row


def test_features_never_include_the_label_or_its_derivative():
    columns = set(NUMERIC_FEATURES) | set(CATEGORICAL_FEATURES)
    assert columns.isdisjoint(LABEL_DERIVED)
    assert "hour" not in columns
    assert "time_window_match" not in columns


def test_evening_sorts_before_the_after_midnight_sub_pattern():
    assert first_cash_out_hour([18, 2]) == 18
    assert first_cash_out_hour([19, 17, 21]) == 17
    assert first_cash_out_hour([2]) == 2
    assert first_cash_out_hour([4, 21]) == 21


def test_rings_are_labelled_by_the_first_actual_cash_out():
    frame = pd.DataFrame([
        _row("RING-A", 2, True, amount=10),
        _row("RING-A", 18, True, amount=20),
        _row("RING-A", 19, True, amount=30),
        _row("RING-B", 0, True),
        _row("RING-B", 1, True),
        _row("RING-C", 17, False),
        _row("RING-D", 4, True),
        _row("RING-D", 21, True),
    ])
    rings = rings_from_frame(frame)

    assert rings.loc["RING-A", "label"] == 18
    assert rings.loc["RING-A", "amount"] == 20  # median of the ring's rows
    assert rings.loc["RING-B", "label"] == 0
    assert rings.loc["RING-D", "label"] == 21
    assert "RING-C" not in rings.index, "a ring with no cash-out has no first hour"
