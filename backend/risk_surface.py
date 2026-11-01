"""H3 hexbin risk surface: the model's ranking rendered as a spatial field.

Why this exists
---------------
The ranked list answers "which ATM next". A judge does not read a map of pins as
a forecast; they read it as a scatter plot. This module lays hexagons over a city
and gives each one a value derived from the *same* scores that order the list, so
the map and the table cannot disagree.

Which number it uses, and why
-----------------------------
Every ranked location carries three numbers:

  risk_score     row model output. Measured across seeded cities, every ATM
                 scores 74-99 regardless of its rank, so it carries no ordering
                 information. Using it here would paint the whole city red.
  display_score  a within-list min-max stretch of risk_score, presentation only.
                 It does not track rank either (a rank-6 ATM can display 100).
  ranker_score   the A2.1 ranker that orders the list, and the path validated in
                 model/validation_report.json.

The surface is built from ranker_score. Nothing here converts it to a probability
claim: the response says `calibrated: false`, and the bands below are quantiles of
this city's own cells, not absolute risk levels.

Constructing a cell value
-------------------------
  1. each ATM's ranker score is placed at its coordinates
  2. H3 resolution-8 hexagons (461 m edge, ~0.55 km^2) tile the city's bounding
     box, padded by 2.5 km
  3. a cell's value is the Gaussian-weighted MEAN of the scores around it
     (sigma = 800 m, about 1.7 hex edges)
  4. a cell further than 2 sigma from every ATM reports no coverage

A mean, not a sum: a sum would let a cell holding four mediocre ATMs outrank a
cell holding the top ATM, which the ranked list does not do. Unscored cells are
drawn as `None` (no coverage) rather than 0, because 0 would read as "assessed
and safe".
"""
from __future__ import annotations

import math

import h3

# Res 8 is ~461 m per hex edge (~0.55 km^2): neighbourhood scale, which is the
# resolution at which "Koramangala, not Bangalore" is legible. Res 7 (~1.2 km)
# washes a city into one blob; res 9 (~175 m) is offered per-request for a dense
# core.
RESOLUTION_DEFAULT = 8
RESOLUTION_MIN = 7
RESOLUTION_MAX = 9

# Below ~400 m a cell effectively sees only its own ATM and the surface collapses
# back into dots; above ~3 km every ATM in a city reaches every cell and it
# flattens. 800 m is about 1.7 hex edges at res 8: measured on a seeded case,
# spread across cells is 54 points at 800 m versus 23 at 1200 m, where the field
# washes flat.
SIGMA_M_DEFAULT = 800.0
SIGMA_M_MIN = 400.0
SIGMA_M_MAX = 3000.0

EARTH_RADIUS_M = 6_371_008.8

# Padding around the ATM extent when tiling the city box. Sized to the map's
# landing zoom (14, roughly a 10 km viewport) so a tightly clustered city still
# produces a full-screen surface instead of a small island of hexes: Puducherry's
# ATMs span 2.5 km, and 4 km of padding takes the box to ~10.5 km across.
PAD_M_DEFAULT = 4000.0
# Soft ceiling on cells per city. Chennai's ATMs span 18 km, which is ~670 res-8
# cells before any padding, so the cap has to sit above that or the tiling would
# have to cut the city in half. Padding is what yields when a box is too big.
MAX_CELLS = 900

# Relative bands, as fractions of the scored cell count. Relative on purpose:
# ranker_score is a relevance ordering, not a calibrated probability, so an
# absolute cut would invent a meaning it does not have.
PRIORITY_FRACTION = 0.15
WATCH_FRACTION = 0.40


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres.

    Not Euclidean degrees: a degree of longitude spans 111 km at the equator and
    ~96 km at Chennai's latitude, so scoring in raw degrees would systematically
    favour the northern edge of every city.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def gaussian_weight(distance_m: float, sigma_m: float) -> float:
    if sigma_m <= 0:
        return 0.0
    return math.exp(-(distance_m * distance_m) / (2.0 * sigma_m * sigma_m))


def cell_ring(cell: str) -> list[list[float]]:
    """Polygon ring as [[lat, lng], ...] for L.polygon."""
    return [[round(lat, 6), round(lng, 6)] for lat, lng in h3.cell_to_boundary(cell)]


def surface_cells(points: list[dict], resolution: int = RESOLUTION_DEFAULT,
                  pad_m: float = PAD_M_DEFAULT, max_cells: int = MAX_CELLS) -> set[str]:
    """Every H3 cell covering the city box, not just those near an ATM.

    Tiling the whole box matters for the demo read: cells only around the ATMs
    look like a scatter of hexagons with gaps, while a full tiling with some
    cells left empty looks like a surface with coverage holes - which is what it
    is. The empty cells cost nothing to draw and make the shape of the data
    legible instead of implying the city ends at the last ATM.
    """
    lats = [float(p["lat"]) for p in points]
    lngs = [float(p["lng"]) for p in points]
    pad = pad_m

    def _box(pad_metres: float) -> set[str]:
        pad_lat = pad_metres / 111_320.0
        pad_lng = pad_metres / (111_320.0 * max(0.2, math.cos(math.radians(sum(lats) / len(lats)))))
        ring = [
            (min(lats) - pad_lat, min(lngs) - pad_lng),
            (min(lats) - pad_lat, max(lngs) + pad_lng),
            (max(lats) + pad_lat, max(lngs) + pad_lng),
            (max(lats) + pad_lat, min(lngs) - pad_lng),
        ]
        return set(h3.polygon_to_cells(h3.LatLngPoly(ring), resolution))

    cells = _box(pad)
    # Shrink the padding, never the city extent: truncating the cell set would
    # silently drop a side of the city and read as "nothing here", and shrinking
    # below pad 0 is impossible anyway. If a city is still over the cap at pad 0,
    # the honest answer is more cells, not a smaller map.
    while len(cells) > max_cells and pad > 0.0:
        pad *= 0.75
        cells = _box(pad)
    return cells


def _bands(values: list[float]) -> tuple[float, float]:
    """Priority/watch cut points as quantiles of this city's scored cells.

    Quantiles rather than constants so the map always shows *where* risk
    concentrates relative to the rest of the city. With a flat field every cell
    is equally hot and the bands collapse toward the same value, which is the
    honest picture of a model that cannot separate them.
    """
    scored = sorted(v for v in values if v is not None)
    if not scored:
        return 0.0, 0.0
    n = len(scored)

    def at(fraction: float) -> float:
        idx = min(n - 1, max(0, int(round((1.0 - fraction) * n)) - 1))
        return scored[idx]

    return at(PRIORITY_FRACTION), at(PRIORITY_FRACTION + WATCH_FRACTION)


def build_surface(points: list[dict],
                  resolution: int = RESOLUTION_DEFAULT,
                  sigma_m: float = SIGMA_M_DEFAULT,
                  pad_m: float = PAD_M_DEFAULT) -> dict:
    """Build cells for one city.

    `points` are `{id, lat, lng, score}` where score is the ranker's 0-1
    relevance score. Points without a score are still laid out so the map shows
    where the registry is, but contribute no value.
    """
    resolution = max(RESOLUTION_MIN, min(RESOLUTION_MAX, int(resolution)))
    sigma_m = max(SIGMA_M_MIN, min(SIGMA_M_MAX, float(sigma_m)))

    if not points:
        return {
            "cells": [],
            "summary": {"cells": 0, "scored": 0, "priority": 0, "watch": 0, "background": 0},
        }

    scored = [(p, float(p["score"])) for p in points if p.get("score") is not None]
    cells = surface_cells(points, resolution=resolution, pad_m=pad_m)

    # Counted per cell rather than per distance-to-centre: a res-8 centre is
    # almost never within a metre of an ATM, so a centre test reported 0 for
    # every hot hex and made the field useless in a tooltip.
    owners: dict[str, int] = {}
    for p, _ in scored:
        own = h3.latlng_to_cell(float(p["lat"]), float(p["lng"]), resolution)
        owners[own] = owners.get(own, 0) + 1

    raw: list[dict] = []
    for cell in cells:
        lat, lng = h3.cell_to_latlng(cell)
        total_w = 0.0
        weighted = 0.0
        nearest_id, nearest_m = "", None
        driver_id, driver_score, driver_influence = "", None, -1.0
        for p, score in scored:
            d = haversine_m(lat, lng, float(p["lat"]), float(p["lng"]))
            if nearest_m is None or d < nearest_m:
                nearest_id, nearest_m = str(p.get("id", "")), d
            w = gaussian_weight(d, sigma_m)
            if w <= 0.0:
                continue
            influence = w * score
            if influence > driver_influence:
                driver_id, driver_score, driver_influence = str(p.get("id", "")), score, influence
            total_w += w
            weighted += w * score

        value = None if total_w <= 1e-12 else (weighted / total_w) * 100.0
        # A normalized mean has no sense of "too far to matter": a cell 2.7 km
        # from every ATM still returns a number, because the weights cancel. The
        # surface therefore only extends to 2 sigma from an ATM. Past that it
        # reports no coverage instead of extrapolating a hotspot.
        reach_m = 2.0 * sigma_m
        if nearest_m is None or nearest_m > reach_m:
            value = None
        raw.append({
            "h3": cell,
            "center": [round(lat, 6), round(lng, 6)],
            "boundary": cell_ring(cell),
            "score": None if value is None else round(value, 1),
            "atm_count": owners.get(cell, 0),
            # A smoothed cell often holds no ATM of its own. Naming the nearest
            # one and the one that actually drives the value keeps a red hex
            # explainable in a tooltip instead of looking arbitrary.
            "nearest_atm": nearest_id,
            "nearest_m": None if nearest_m is None else round(nearest_m, 0),
            "top_atm": driver_id,
            "top_atm_score": None if driver_score is None else round(driver_score * 100.0, 1),
        })

    priority_cut, watch_cut = _bands([c["score"] for c in raw])
    for cell in raw:
        score = cell["score"]
        if score is None:
            cell["level"] = "none"
        elif score >= priority_cut:
            cell["level"] = "priority"
        elif score >= watch_cut:
            cell["level"] = "watch"
        else:
            cell["level"] = "background"

    raw.sort(key=lambda c: (c["score"] is None, -(c["score"] or 0.0), c["h3"]))
    summary = {
        "cells": len(raw),
        "scored": sum(1 for c in raw if c["score"] is not None),
        "priority": sum(1 for c in raw if c["level"] == "priority"),
        "watch": sum(1 for c in raw if c["level"] == "watch"),
        "background": sum(1 for c in raw if c["level"] == "background"),
    }
    return {
        "cells": raw,
        "summary": summary,
        "resolution": resolution,
        "sigma_m": sigma_m,
        "cell_edge_m": round(h3.average_hexagon_edge_length(resolution, unit="m"), 1),
        "reach_m": round(2.0 * sigma_m, 1),
        "bands": {"priority_at": round(priority_cut, 1), "watch_at": round(watch_cut, 1)},
        "method": "gaussian-weighted mean of per-ATM ranker scores",
        "basis": "ranker_score",
        "calibrated": False,
        "note": "Uncalibrated relative ordering. Cell values are not probabilities, "
                "and bands are quantiles within this city.",
    }


def points_from_ranked(ranked: list[dict]) -> list[dict]:
    """Adapt a prediction's ranked locations to surface points.

    Prefers ranker_score (the validated ordering). Falls back to the row-model
    score only when no ranker artifact produced one, and says so in the payload
    via `basis`, so a fallback surface is never mistaken for the ranker's.
    """
    points = []
    for loc in ranked:
        if loc.get("latitude") is None or loc.get("longitude") is None:
            continue
        if loc.get("ranker_score") is not None:
            score = float(loc["ranker_score"])
        else:
            score = float(loc.get("risk_score") or 0.0) / 100.0
        points.append({
            "id": loc.get("atm_id", ""),
            "lat": loc["latitude"],
            "lng": loc["longitude"],
            "score": score,
        })
    return points


def build_for_ranked(ranked: list[dict],
                     resolution: int = RESOLUTION_DEFAULT,
                     sigma_m: float = SIGMA_M_DEFAULT) -> dict:
    surface = build_surface(points_from_ranked(ranked), resolution=resolution, sigma_m=sigma_m)
    if ranked and all(loc.get("ranker_score") is None for loc in ranked):
        surface["basis"] = "risk_score"
        surface["method"] = "gaussian-weighted mean of per-ATM row-model scores"
        surface["note"] = ("Ranker unavailable, fell back to row-model scores, which do not "
                           "order this list. Surface shows intensity, not rank.")
    return surface
