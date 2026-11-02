# ATLAS — PS 26184 Gap Plan

**Status: Phase 1 (1.1–1.3) is built locally and uncommitted; Phases 2–4 are
proposal.** Every measurement below was taken against `main` (`14ef942`) and the
synthetic fixtures. No real complaint, transaction or outcome data has been seen
by this build; see `docs/VALIDATION_PLAN.md` for how that would change.

The problem statement asks for four things. This document states which of them
the prototype actually does today, then closes them in order of what a judge or
an investigating officer would probe first.

| PS capability | Today | Evidence |
| --- | --- | --- |
| Receive a complaint | **Done (Phase 1).** `POST /api/complaints` creates the case, anchors its synthetic records to the complaint time, and ranks locations in one request. | §1.1, §1.4. |
| Rank cash-out locations | **Done**, surface + zones shipped. | `14ef942`, `eb38afb`. |
| Say *when* the cash-out is expected | **Removed (Phase 1).** No predicted window or lead time is shown; screens describe the records on file. | §1.2, §1.4. |
| Jurisdiction-correct access | **Partly.** Reads scoped; writes unverified. | `visibility_filter`, `require_case`; §3.2. |
| Alerting at scale | **Partly.** Durable dispatch exists; outbound is unpublished; 8,000/day unmeasured. | §3.3, §3.4. |

---

## 1. Phase 1 — intake, honest time, honest labels

Three changes. They are ordered because 1.1 produces the row that 1.2 and 1.3
then describe correctly.

### 1.1 `POST /api/complaints` — the missing input

**Why it is the first thing to build.** The system's problem statement starts at
a complaint and the build cannot receive one. A demo that begins with seeded
rows concedes the integration story, which is exactly what PS 26184 is scored on.

**Contract** (NCRP-shaped, not a schema mirror):

```jsonc
POST /api/complaints
{
  "external_ref": "NCRP-2026-000123",   // required; idempotency key
  "district":     "Chennai",            // required; authoritative, never inferred
  "category":     "UPI fraud",          // required
  "amount":       48000,                // required, > 0
  "incident_at":  "2026-09-01T17:20:00Z", // required; complaint time == T0
  "description":  "…",                  // optional; never parsed for district
  "victim_name":  "…", "contact": "…"   // optional
}
```

Responses: `201` with `case_id`, `district`, `city_id`, and the prediction payload;
`200` on a replay of a seen `external_ref` with an identical body; `409` when the
same `external_ref` arrives with different fields; `422` for an unknown district
or a missing field, with nothing written.

**Rules that matter more than the shape**

- `district` is resolved through `district_to_city` (`main.py:525`) *before* the
  case is inserted, and is never derived from `description`. A complaint that
  names "Chennai" in prose but files under `Mumbai` is stored under Mumbai —
  otherwise jurisdiction becomes a text-matching guess.
- Auth is `require_permission("write")` + `require_csrf`, the same pair the
  transaction simulator uses (`main.py:1396`). There is no district-scoped
  permission to check: users carry no district field and case visibility is keyed
  on `department` (`access_control.visibility_filter`). Intake therefore sets the
  new case's `department` from the filing officer, which is the ownership
  dimension that actually exists. `role × district` authorization is Phase 3
  (§3.2); a check written here would be a check that cannot fail.
- Every derived value comes from `stable_int(case_id)` (`main.py:322`), never from
  the global `random`, which `get_predictions_for_case` reseeds at `main.py:546`.

**Seeding relative to the complaint.** `ensure_synthetic_transactions`
(`main.py:325`) hardcodes `base_time = datetime(2026, 9, 1, 17, tz=utc)`
(`main.py:349`). For an intake case the anchor must be `incident_at`; otherwise
every complaint, whenever filed, produces records that predate or postdate it by a
fixed offset and no lead time is expressible. The anchor is passed in, and the
seeded-fixture path keeps the constant — this is what protects the
`baseline@42 = 0.9068` regeneration guarantee in `backend/model/assumption_report.json`.

**One column.** `external_ref` needs a unique index on `cases`, which means a new
Alembic revision on top of `0000_baseline.py`. The alternative — smuggling the ref
into `description` — loses uniqueness and makes replay detection a string search.

**Tests** (`backend/tests/test_complaints_intake.py`)

- `201` creates one case, twelve records, and a prediction.
- replay of the same ref returns `200` and creates nothing new.
- same ref with a different amount returns `409`.
- unknown district returns `422` and leaves no partial row.
- prose mentioning another city does not move the case out of its district.
- read-only token `403`; missing CSRF `403`.
- records anchored to `incident_at` (max `occurred_at` within 18h, and the `hour`
  feature reflects the complaint clock rather than 17:00).
- the existing `test_api` suite and the `baseline@42` regeneration are unchanged.

### 1.2 Remove `expected_window`

**The finding.** `_expected_window` (`main.py:596-607`) takes the mean
`occurred_at` hour of the records the same request generated (`main.py:594`,
records created at `main.py:360`) and maps it to a hardcoded bucket
(`17→"17:00-19:00"` … `≥21→"20:00-22:00"`). The "predicted window" is a
relabelling of its own input. It is not a forecast and cannot miss, because it is
derived from the answer.

The dashboard's lead time is worse. `_window_lead_hours` (`main.py:1301-1315`)
computes hours from *now* to the next occurrence of that clock time, and
`get_dashboard` (`main.py:1251-1298`) renders it as `avg_lead_time`. That is a clock
with a median, and it drifts while the demo runs. A judge who leaves the tab open
for an hour can watch "average lead time" change without a single new record.

On screen it reads as model output in nine places: `CaseDetail.tsx:283`,
`PredictionCard.tsx:116` and its exported text at `:39`, `MapView.tsx:273` and
`:573`, `CasesTable.tsx:356` and `:379`, `RankedLocationsTable.tsx:138`, and
`ScenarioRunner.tsx:75`.

**Change**

- Backend: delete `_expected_window`, drop the field from the ranked payload
  (`main.py:693`, `1163`), stop persisting it (`models_db.py:93`, `main.py:475`),
  delete `_window_lead_hours`, and make `avg_lead_time` read
  `"Not measured (needs labelled outcomes)"` until Phase 2 measures one.
  Also `main.py:868`, `911`, `957`, `1200`, `1456`, `1503`.
- Frontend: replace the render labels with an observed span taken from the case's
  records — "Observed cash-out times 17:00–23:00 (12 linked records, synthetic)".
  That sentence is a description of stored rows and cannot be wrong.
- Fixtures: `types/index.ts:23`, `fallbackData.ts`, `demoData.ts:15`,
  `ScenarioRunner.test.tsx:30`.

**Two consequences need a decision, because neither is free** (see §6).

- `MapView.tsx:188` and `RankedLocationsTable.tsx:20` *filter* on the field. The
  filter can survive by bucketing the observed span, or be dropped.
- `Alert.time_window` is `NOT NULL` (`models_db.py:114`) and is populated from the
  field at `main.py:1456`. It needs either a repurposed value (the observed span)
  or a migration.

**Acceptance:** no screen, export or API response asserts a time the records do
not show; no clock-derived number is presented as a forecast.

### 1.3 Label `risk_score` as case severity

**The finding.** Serving builds `num_mule_accounts` from `case.linked_accounts`
(2–12) and `recent_withdrawal_freq` from `min(mules/8, 0.9)` (`main.py:657-659`),
while training used `num_mules = 1` for ~96% of rows (`generate_data.py:340`).
Training rows score 9.7–32.2; serving rows score 74–99 for **every** ATM. The
number therefore tracks the case, not the location: it is severity, not a per-ATM
chance. That is also why the surface had to be rebuilt on `ranker_score` — the
model that only sees ATM-level features.

Phase 1 changes wording only; the mechanism is fixed in §3.1.

- One shared sentence in `lib/riskAreas.ts`: the score is our severity judgement
  for the case on synthetic fixtures, not the probability of a cash-out at this
  ATM, and ranking is by the ATM-level ranker.
- `areaSecondary` (`riskAreas.ts:34`) rewords "Uncalibrated model score" to
  "Uncalibrated case-severity score"; `ExplainabilityPanel.tsx:67` follows.
- Keep the negative framing: nothing pairs the score with "probability" except to
  deny it.

**Acceptance:** grep finds no user-facing string implying a per-location
probability; every screen that prints `risk_score` carries the shared label.

### 1.4 Phase 1 as built (deviations and exact shapes)

- `cases.external_ref` is **nullable** with a unique index (revision
  `0006_case_external_ref`). Seeded and synthetic cases stay `NULL`; SQLite and
  PostgreSQL both treat those as distinct, so no fixture needed a fake reference.
- Revision `0007_drop_expected_window` batch-drops `ranked_locations.expected_window`
  (SQLite cannot drop a column in place). The downgrade re-adds it empty rather than
  backfilling, since the value is recomputable from the records that remain.
- Intake response: `status` (`created` / `replayed`), `case_id`, `external_ref`,
  `district`, `city_id`, `city`, `created_at`, `record_count`, `observed_window`,
  and the full `prediction`. Replay compares `district`, `category`, `amount` and
  `incident_at`; a mismatch returns `409` naming the differing fields.
- `category` is matched case-insensitively against the registry's own labels
  (`"UPI fraud"` → `"UPI Fraud"`) so the case table's exact-match drill-down links
  it with seeded cases; an unknown category is kept as filed. Blank
  `external_ref` or `category` (including whitespace) is `422` before any write.
- `observed_window` is `{label, start, end, end_day_offset, hours[], records}` — a
  span over stored `transaction_records`, shared by every location in the ranking
  because it describes the case, not the ATM. Empty state:
  `"no cash-out records"`.
- The time filter survives as four buckets over `hours[]` — morning (05–11),
  afternoon (12–16), evening (17–20), night (21–04) — in
  `frontend/src/lib/observedHours.ts`, labelled "Observed Hours" and tooltip'd as
  records, not a prediction.
- `Alert.time_window` is repurposed, not migrated: it carries the observed label
  (`"18:05–20:00 UTC"`) on pipeline alerts, the transaction path and manual alerts.
- `avg_lead_time` now reads
  `"Not measured — no confirmed cash-out outcomes linked yet"`; `_window_lead_hours`
  and `_expected_window` are deleted, and `tests/test_api.py` asserts their absence.
- Intake is covered by `backend/tests/test_complaints_intake.py` (19 tests):
  create, replay, `409`, `422`, CSRF, auth, district authority, department
  ownership, record anchoring and observed-window shape.
- Regeneration guarantee: `ensure_synthetic_transactions(anchor=None)` keeps the
  fixed `2026-09-01T17:00Z` base, so `baseline@42` is unchanged. Anchored records use
  `stable_int(f"{case_id}:cashout:{index}")` and never the global RNG.

---

## 2. Phase 2 — lead time, measured before modelled

The current fixtures cannot answer "how early did we warn". `occurred_at` is
`base + (seed + index) % 18` hours (`main.py:360`) — independent per-row hashes,
not a cash-out process. A time model fitted to that learns the fixture.

So the first deliverable is a measurement, not a model:

1. Reuse the held-out group split the runners already build
   (`revalidate_model.py:274`, `perturb_ranker.py:272`) and seed per-case context
   from `zlib.crc32(group_id)` as `revalidate_model.py:234` does, so no ring
   straddles the boundary.
2. Ask the narrow question: on held-out rings, is the first cash-out hour
   predictable better than a permutation of the same timestamps? Report hit rate
   within ±1h against that permutation baseline.
3. If the answer is "no better than permutation", write that down and stop.
   Lead time then needs outcome logs, which is `docs/VALIDATION_PLAN.md` §2.
4. If it is better, define lead time as
   `min(TransactionRecord.occurred_at) − Case.created_at`. No schema change is
   needed: `case.created_at` is the complaint time and `occurred_at` is the
   cash-out. Report it as a distribution across cases, never as one promised
   number.

Deliverable: `docs/LEAD_TIME_MEASUREMENT.md`. No UI until the number exists.

---

## 3. Phase 3 — serving alignment, then trust and load

### 3.1 Align `risk_score` serving features with training
Serve the mule-account and withdrawal-frequency features from the distribution
training actually saw, or retrain against the serving distribution — not both at
once, so the cause stays attributable. Acceptance: the eight demo cities show
within-city spread again, and no city falls flat at the band floor the way
Hyderabad does today (`risk_surface.py` `FLAT_EPS`). Re-verify the surface and the
DBSCAN zones after the change, because both consume the same payload.

### 3.2 `role × district` RBAC

Reads are scoped by `visibility_filter` and `require_case`, but on `department`:
users carry no district field, so there is no district predicate to enforce yet.
The first step is a `users.district` column and a demo backfill; then the same
scope applies to writes: `POST /api/alerts`, `POST /api/alerts/{id}/acknowledge`,
`POST /api/alerts/{id}/notify`, `POST /api/cases/{id}/resolve`,
`POST /api/cases/{id}/action`, and `POST /api/complaints`. Acceptance: an officer
in district A cannot create or acknowledge an alert, or file a complaint, for
district B, and the refusal is a `403` with no side effect.

### 3.3 Signed outbound webhook
HMAC-SHA256 over `timestamp.body`, retry with backoff, dead-letter on exhaustion —
the durable dispatch already has the queue. No secret in logs, no unsigned
fallback.

### 3.4 8,000 complaints/day
Replay the intake endpoint at that rate against a local instance and report p50
and p95, plus where the time goes. Report the number even if it is bad; measuring
first is the point.

---

## 4. Phase 4 — packaging
Strategic intel brief (one page), one continuous loop on screen
(complaint → prediction → zone → alert → resolve), noise cleanup including the
`ws://localhost:8000/ws/alerts … 403` console error, and slide copy discipline —
`FIGHT_CLUB` and `164305` only, no model metrics, no member names.

---

## 5. Order and rough cost

| Step | Scope | Sessions (rough) |
| --- | --- | --- |
| 1.1 | intake endpoint, `external_ref` migration, tests | 1–2 |
| 1.2 | remove `expected_window` end to end, observed span | 1 |
| 1.3 | shared label, the score render sites | 0.5 |
| 2 | permutation baseline, then decide | 1–2 |
| 3.1–3.4 | alignment, RBAC, webhook, load | 3–5 |
| 4 | brief, loop, cleanup, copy | 1–2 |

Each step lands as its own commit, with a message that names the finding rather
than the feature, and nothing is pushed without asking.

---

## 6. Decisions taken before writing code

All four were resolved in favour of the recommendation and are reflected in §1.4.

1. **`external_ref` column + migration** — added (`0006_case_external_ref`).
2. **Time filter in `MapView` / `RankedLocationsTable`** — kept, bucketed on
   observed hours and labelled "Observed Hours".
3. **`Alert.time_window`** — repurposed to carry the observed span; no migration.
4. **Phase 1 shape** — three ordered commits: intake, observed time, label
   discipline.

---

## 7. How this will be verified

```powershell
# backend
cd backend; python -m pytest -q
# frontend
cd frontend; npm test; npx tsc --noEmit; npm run lint
# fixture guarantee: prints the sweep without rewriting the committed report;
# baseline@42 must still read 0.9068
cd backend; python perturb_ranker.py --no-write
```

Plus a live pass on `/real/map` and `/real/cases` for the screen claims, and a
`curl` replay of the intake contract before it is described in any deck.
