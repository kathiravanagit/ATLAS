"""DBSCAN intervention zones over the H3 risk surface.

Why clustering in cell space rather than in lat/lng:

A Euclidean DBSCAN on degrees would make latitude and longitude unequal units
(111 km vs 96 km per degree at Puducherry) and would let two cells that share an
edge look "distant" because their centres are ~460 m apart while two cells three
rows apart look "close" in a sparse area. H3 cells already form a graph, so the
honest distance between two cells is the number of k-ring steps between them.
`eps` here is therefore measured in ring hops, not metres, and adjacency is
`h3.grid_disk(cell, 1)` - the six neighbours that actually share an edge.

What is clustered, and what is deliberately not:

Only `priority` and `watch` cells. A `none` cell is not "assessed and safe" - it
is "no ATM within reach" - and feeding unscored padding into DBSCAN would let
noise become a zone boundary and inflate the zone count. Those cells stay in the
surface for the map to draw; they are never zone members.

The output is an area recommendation, not a prediction: a zone is a set of
adjacent cells that scored highly under the same relative bands. Nothing here
is a probability, and no zone implies a known offender location.
"""
from __future__ import annotations

import h3
import numpy as np
from sklearn.cluster import DBSCAN

# One ring hop = cells that share an edge (centre-to-centre ~800 m at res 8).
# Two hops is included as an option because a single missed cell in the middle
# of a hot area would otherwise split one operational zone into two.
EPS_HOPS_DEFAULT = 1
EPS_HOPS_MAX = 3
# DBSCAN's min_samples includes the point itself: 3 means "this cell and at
# least two neighbours", i.e. a zone is never a single isolated hex.
MIN_SAMPLES_DEFAULT = 3

CLUSTERABLE_LEVELS = ("priority", "watch")


def _graph_distances(cells: list[str], eps_hops: int) -> np.ndarray:
    """Hops between cells, capped at eps_hops + 1.

    The search walks the full H3 grid, not just the cells being clustered: a cell
    is two hops away because the hexagon between them exists, not because that
    hexagon happened to be clusterable. Walking only through `cells` meant a
    single background cell between two hot blobs blocked the bridge that eps_hops
    exists to provide, so eps 1 and eps 2 behaved identically.

    DBSCAN's precomputed metric needs a finite "not a neighbour" value; anything
    above eps is equally unreachable, so the matrix stays small and integer.
    """
    index = {cell: i for i, cell in enumerate(cells)}
    n = len(cells)
    far = float(eps_hops + 1)
    dist = np.full((n, n), far, dtype=float)
    for i, cell in enumerate(cells):
        dist[i, i] = 0.0
        seen = {cell}
        frontier = {cell}
        for hop in range(1, eps_hops + 1):
            neighbours: set[str] = set()
            for current in frontier:
                for nbr in h3.grid_disk(current, 1):
                    if nbr in seen:
                        continue
                    seen.add(nbr)
                    neighbours.add(nbr)
                    j = index.get(nbr)
                    if j is not None and dist[i, j] > hop:
                        dist[i, j] = float(hop)
            if not neighbours:
                break
            frontier = neighbours
    return dist


def _hull(points: list[tuple[float, float]]) -> list[list[float]]:
    """Convex hull (monotone chain) of [lat, lng] points, closed ring.

    A zone outline only has to show its footprint; a hull over the member cells'
    corners is enough and avoids a polygon-union dependency.
    """
    pts = sorted(set(points))
    if len(pts) < 3:
        return [[round(a, 6), round(b, 6)] for a, b in pts]

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper: list[tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    ring = lower[:-1] + upper[:-1]
    return [[round(a, 6), round(b, 6)] for a, b in ring]


def build_zones(surface: dict, eps_hops: int = EPS_HOPS_DEFAULT,
                min_samples: int = MIN_SAMPLES_DEFAULT) -> dict:
    """Cluster the surface's priority/watch cells into intervention zones."""
    eps_hops = max(1, min(int(eps_hops), EPS_HOPS_MAX))
    min_samples = max(1, int(min_samples))

    cells = [
        c for c in surface.get("cells", [])
        if c.get("level") in CLUSTERABLE_LEVELS and c.get("score") is not None
    ]
    priority_total = sum(1 for c in cells if c["level"] == "priority")
    watch_total = sum(1 for c in cells if c["level"] == "watch")

    empty = {
        "zones": [],
        "summary": {
            "zones": 0, "clustered_cells": 0, "noise_cells": 0,
            "priority_cells": priority_total, "watch_cells": watch_total,
        },
        "eps_hops": eps_hops,
        "min_samples": min_samples,
        "method": "DBSCAN on H3 k-ring adjacency",
        "note": (
            "Zones group adjacent priority/watch cells. Synthetic and uncalibrated; "
            "an area to check, not a predicted crime location or a probability."
        ),
    }

    if len(cells) < min_samples:
        empty["summary"]["noise_cells"] = len(cells)
        return empty

    ids = [c["h3"] for c in cells]
    dist = _graph_distances(ids, eps_hops)
    labels = DBSCAN(eps=float(eps_hops), min_samples=min_samples,
                    metric="precomputed").fit_predict(dist)

    groups: dict[int, list[dict]] = {}
    noise = 0
    for label, cell in zip(labels, cells):
        if label < 0:
            noise += 1
            continue
        groups.setdefault(int(label), []).append(cell)

    zones = []
    for label in sorted(groups):
        members = groups[label]
        scores = [float(c["score"]) for c in members]
        priority_cells = sum(1 for c in members if c["level"] == "priority")
        top = max(members, key=lambda c: (float(c["score"]), c["h3"]))
        corners = [tuple(point) for c in members for point in c["boundary"]]
        lat = sum(c["center"][0] for c in members) / len(members)
        lng = sum(c["center"][1] for c in members) / len(members)
        zones.append({
            "zone_id": "",
            "level": "priority" if priority_cells else "watch",
            "cells": len(members),
            "priority_cells": priority_cells,
            "watch_cells": len(members) - priority_cells,
            "score_mean": round(sum(scores) / len(scores), 1),
            "score_max": round(max(scores), 1),
            "top_atm": top.get("top_atm") or top.get("nearest_atm") or "",
            "atm_count": sum(int(c.get("atm_count") or 0) for c in members),
            "center": [round(lat, 6), round(lng, 6)],
            "h3_cells": [c["h3"] for c in members],
            "boundary": _hull(corners),
        })

    # Priority-bearing zones first, then the hotter zone. A deployment list that
    # is not ordered is not a deployment list.
    zones.sort(key=lambda z: (-z["priority_cells"], -z["score_mean"], z["h3_cells"][0]))
    for i, zone in enumerate(zones, start=1):
        zone["zone_id"] = f"Z{i}"

    return {
        "zones": zones,
        "summary": {
            "zones": len(zones),
            "clustered_cells": sum(z["cells"] for z in zones),
            "noise_cells": noise,
            "priority_cells": priority_total,
            "watch_cells": watch_total,
        },
        "eps_hops": eps_hops,
        "min_samples": min_samples,
        "method": "DBSCAN on H3 k-ring adjacency",
        "note": (
            "Zones group adjacent priority/watch cells. Synthetic and uncalibrated; "
            "an area to check, not a predicted crime location or a probability."
        ),
    }
