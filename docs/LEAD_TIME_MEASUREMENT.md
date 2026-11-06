# Lead time: measured before modelled

**Status: measured, negative. No lead time is shown anywhere in the console.**

Phase 1 stopped printing a clock-derived lead time and replaced the predicted
window with `observed_window`, a description of the records already on file.
This note answers the next question — whether the first cash-out hour is
predictable at all — before any UI puts a number back on screen.

## The question

On rings the model has never seen, can complaint-time context pick the hour of
the first cash-out better than a permutation of the same labels?

If no, a lead-time figure would be invented, and the honest output stays
"Not measured". If yes, the next step would be `min(occurred_at) − created_at`
reported as a distribution across cases.

## What was measured

| Piece | Choice |
|---|---|
| Rows | Injected fraud rings in `backend/data/transactions_200k.csv` (1,000 rings; 999 have at least one cash-out row) |
| Split | `train_model.establish_splits`, seed 42 — group holdout, plus the union with time and location holdouts; no ring straddles the boundary |
| Label | Circular first hour among the ring's `cash_out_occurred == 1` rows. Hours rotate at noon so evening 17–22 sorts before the generator's late-night 0–4 sub-pattern |
| Features | Complaint-time columns only: amount, mule count, month, weekday, ATM density/type, victim/suspect distances, history, hotspot density, crime type, city |
| Excluded | `hour`, `time_window_match` (derived from `hour`), the cash-out label and ring membership — enforced by `tests/test_lead_time_measurement.py` |
| Model | `RandomForestRegressor` on the rotated label, one prediction per held-out ring |
| Baselines | The training-set modal hour applied to every held-out ring, and 2,000 permutations of the held-out labels against the model's fixed predictions |
| Metric | Hit rate within ±1 hour on the 24-hour circle |

First-hour distribution across rings: 17:00 (293), 18:00 (300), 19:00 (214),
20:00 (115), 21:00 (48), 22:00 (10), and 19 rings starting after midnight
(00:00–04:00). The marginal evening prior is strong; the question is whether
features add anything to it.

## Results

`python measure_lead_time.py` (seed 42, 2,000 permutations):

| Evaluation | Train rings | Held-out rings | Model ±1h | Exact | Permutation mean (95th) | p | Always 18:00 |
|---|---|---|---|---|---|---|---|
| Group holdout | 570 | 143 | **0.692** | 0.266 | 0.713 (0.755) | 0.824 | **0.804** |
| Group + time + location | 570 | 429 | **0.739** | 0.273 | 0.741 (0.765) | 0.588 | **0.807** |

The model does not beat the permutation of its own predictions. In both
evaluations it scores slightly below the permutation mean, and the modal hour
alone — "cash-out is most likely at 18:00" — beats every model prediction. The
features carry no information about the first hour beyond the marginal evening
prior that permutation already accounts for.

This is what the generator implies: ring hours are drawn from the evening
window (with a late-night sub-pattern) per member, independently of amount,
mule count, city, crime type, or geography. A model fitted to that learns the
marginal distribution, not a case-level signal.

## Consequences

- `avg_lead_time` stays `"Not measured — no confirmed cash-out outcomes linked yet"`.
- The observed window stays descriptive: it reports the span of stored records
  and does not forecast the next withdrawal.
- No lead-time UI, alert wording, or dashboard number changes until timestamped
  outcomes exist.

The serving fixtures cannot substitute for those outcomes. Intake anchors
records at `incident_at` and spreads them with `(stable_int(case_id) + index) % 18`
hours, so `min(occurred_at) − created_at` would measure that hash, not a warning
that preceded a real cash-out. The training table is worse for the purpose: it
stores hour-of-day but no elapsed time, so even a positive ±1h result would not
produce hours of lead time.

## What would change the answer

A log that pairs each complaint's filing time with the time of the first
confirmed cash-out, on cases the model did not train on (see
`docs/VALIDATION_PLAN.md` §2). The same script can then be rerun unchanged; only
a hit rate above the permutation distribution, and a measured distribution of
`min(occurred_at) − created_at`, would justify showing a lead time. It would be
shown as a distribution, never as one promised number.

Reproduce: `cd backend && python measure_lead_time.py`. Dataset
`sha256:e94f0d4c4345d883b7a1093b23ffb2b2fb8c9d77e8a2234e9efc57d76a400388`;
protocol guards in `backend/tests/test_lead_time_measurement.py`.

## Anchor check (verified 2026-11-06, before the demo re-record)

The negative result above discloses `min(occurred_at) − Case.created_at`; if
`created_at` were still the DB default (`datetime.now`) while `incident_at` is
the complainant's stated time, that delta would be measured against the wrong
anchor and the number would be contaminated. Grep of the intake handler
(`main.create_complaint`, line ~1637) shows `created_at=incident_at` is set
**explicitly** on every intake `Case(...)` row, overriding the `models_db.Case`
default. The anchor is correct; the negative stands on a clean number. Note
this check does not change the measurement itself — Phase 2 reads the
training-table rings, not intake rows — but it means a future intake-based
lead-time rerun can use `created_at` as the complainant's time without a
migration.
