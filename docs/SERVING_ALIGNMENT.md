# Serving alignment: why the surface went flat

**Status: Phase 3.1 built. The eight demo cities are banded again, and the
`baseline@42` regeneration guarantee is unchanged.**

`docs/PS_GAP_PLAN.md` §3.1 said to serve the score's inputs from the
distribution training saw, or retrain against serving, not both. This note
records what was measured before any code changed, which causes survived the
measurement, and what the delivered payload now contains.

## The premise had to be corrected first

Phase 1 wrote that "training rows score 9.7–32.2; serving rows score 74–99"
(`PS_GAP_PLAN.md` §1.3). Re-measured on the fitted artifacts, that is the
**legitimate-row** band, not the training band as a whole:

| Rows from `transactions_200k.csv` | n | p05 | p50 | p95 |
|---|---|---|---|---|
| `is_injected_fraud = True` | 3,000 | 68.6 | 97.1 | 99.2 |
| `is_injected_fraud = False` | 4,000 | 15.1 | 19.1 | 22.8 |

A complaint is a reported fraud, so a served score of 88–99 is where the row
model already puts fraud rows. The row score was **not** out of distribution.
It is still a case-severity score, not a per-ATM probability, which is why the
surface ranks by `ranker_score`; that part of §1.3 stands.

The defect that needed fixing was downstream: **the ranker surface collapsed to
one flat band in Hyderabad.** With the victim pinned to the city centre, every
Hyderabad ATM fell outside the ranker's positive region (its training positives
were all within 3.07 km of the victim), so all eight scores were exactly `0.0`,
below `risk_surface.FLAT_EPS`.

## Serving versus training, measured per feature

The probe scored the eight demo cities against the 64-ATM registry and compared
each candidate's feature vector with the fraud rows the artifacts were fitted on.

| Feature | Training (fraud rows) | Serving before | Cause |
|---|---|---|---|
| `distance_from_victim_km` | p05 0.39, p50 1.43, p95 2.91 | 0.23–25.71, p50 6.56 | victim placed at the city centre; training placed it near the ATM the transaction used |
| `suspect_distance_km` | p05 0.57, p50 2.09, p95 4.33 | 0.16–26.32, p50 6.69 | same |
| `proximity_score` | 0.64–1.00 (p50 0.82) | 0.00–0.97 (p50 0.18) | derived from the distance above |
| `time_window_match` | 1.0 for 2,537/3,000 rows | `0.0` for every served case | `hour` was the arithmetic mean of record hours, so a window crossing midnight averaged to daytime |
| `hour` | 17–22 (85%), 0–4 tail | 7–15 | same |
| `atm_type_score` | {0.4, 0.6, 0.7, 0.8, 1.0} | {0.4, 0.55, 0.7, 0.85, 1.0} | type came from a case-id hash; `AtmLocation` has no type column, but `city_data` does |
| `historical_crime_density` | 4–20 (p50 11) | 1–14 | same: hash instead of the registry's risk |
| `num_mule_accounts` | 1–8 | 3–12 | intake can file 12 linked accounts; the generator tops out at 8 |
| `recent_withdrawal_freq` | ATM property, p50 0.5 | `min(mules/8, 0.9)`: 0.375–0.9 | served from the case's mule count instead of the ATM's base risk |
| `atm_cashout_history` | p50 0.25, p95 0.74 | 0.50–1.00 | the fixture has 12 records per case, so the city maximum is 1–2; **left unchanged** |

`amount` was also left unchanged: it is the complaint's filed amount, not a
feature the server may redefine. Large filed amounts are legitimately outside
the synthetic support and should surface as drift, not be clamped.

## What changed

1. **Complaint geometry** (`main.py`, `_offset_point`). The synthetic victim is
   anchored to one deterministic registry ATM 0.4–1.6 km away — roughly
   p05–p60 of the trained fraud distance — and the suspect 0.5–4.0 km from the
   victim. Real intake would carry a geocoded victim point; this fixture has
   none, so it reuses the geometry the artifacts were fitted on.
2. **Clock hour** (`_circular_hour`). The case hour is the mean of the observed
   record hours on the 24-hour circle, so an evening window that crosses
   midnight no longer averages to noon.
3. **Registry ATM attributes.** `atm_type_score` and
   `historical_crime_density` come from `city_data`'s type and risk for that ATM
   (density = base risk × 15, clipped to 1–20), with the old hash fallback kept
   only for rows the registry does not contain.
4. **Mule-account inputs.** The model sees `num_mule_accounts` clamped to 1–8
   (the generator's range), and `recent_withdrawal_freq` from the ATM's registry
   risk rather than the case's mule count. The UI still reports the filed number
   of linked accounts.

## Result on the seeded demo database

`python seed.py` builds 64 ATMs and 30 cases; `CC-2026-0201…0207` cover the
seven non-Puducherry districts and `CC-2026-0147` is Puducherry. Re-reading each
district case:

| City | Case | `risk_score` | Ranker spread | Flat | Priority cells | Watch cells | DBSCAN zones |
|---|---|---|---|---|---|---|---|
| Puducherry | CC-2026-0147 | 92.4–98.9 | 0.584 | no | 5 | 9 | 1 |
| Chennai | CC-2026-0201 | 93.9–97.2 | 0.361 | no | 42 | 0 | 4 |
| Delhi | CC-2026-0202 | 92.8–99.3 | 0.317 | no | 51 | 0 | 5 |
| Mumbai | CC-2026-0203 | 91.9–98.5 | 0.185 | no | 34 | 0 | 3 |
| Bangalore | CC-2026-0204 | 98.4–99.6 | 0.396 | no | 16 | 13 | 3 |
| Kolkata | CC-2026-0205 | 93.2–97.0 | 0.256 | no | 11 | 29 | 2 |
| Hyderabad | CC-2026-0206 | 93.8–96.7 | 0.195 | **no** | 18 | 11 | 2 |
| Ahmedabad | CC-2026-0207 | 97.1–99.1 | 0.839 | no | 13 | 29 | 1 |

Every district keeps a within-city spread and at least one priority cell, and
DBSCAN still emits zones because it consumes the same payload.

`python perturb_ranker.py --no-write` still prints
`baseline ranker Hit@3 0.9068`, so the phase did not touch the regeneration
guarantee.

## Limits worth stating on screen or in Q&A

- The row score remains **uncalibrated case severity**, not the probability of a
  cash-out at this ATM. Nothing here changes that wording.
- The ranker is a synthetic retrieval model. Its positive region is ~3 km, and
  the serving registry has 8 ATMs per city against 50 in training, so a city
  usually shows **one** hotspot, with the remaining cells at 0. That is the
  artifact's honest resolution, not a measured city-wide risk field.
- `atm_cashout_history` remains at the top of its training range because the
  fixture has only a few records per ATM. Manufacturing a month of history to
  lower it would be worse than reporting the cold start.
- The complaint's filed `amount` is served as filed. Very large amounts are
  outside the synthetic support and should be read as drift.

## Reproduce

```powershell
cd backend
python -m pytest tests/test_serving_alignment.py -q
python -m pytest -q
python perturb_ranker.py --no-write    # baseline@42 must stay 0.9068
```

The alignment tests pin the geometry, the circular hour, registry-driven ATM
attributes, the 1–8 mule clamp, and a non-flat, banded surface for all eight
demo cities.
