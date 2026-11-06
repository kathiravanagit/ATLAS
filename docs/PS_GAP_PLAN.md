# ATLAS — PS 26184 Gap Plan

**Status: Phase 1 (1.1–1.3) is built and pushed. Phase 2 is measured and
negative (§2.1). Phases 3.1–3.4 are built (§3.1.1, §3.2.1, §3.3.1, §3.4.1).
Phase 4 is built (§4.1).** Every measurement below was taken against `main` (`3b0c7f5`)
and the synthetic fixtures. No real complaint, transaction or outcome data has
been seen by this build; see `docs/VALIDATION_PLAN.md` for how that would change.

The problem statement asks for four things. This document states which of them
the prototype actually does today, then closes them in order of what a judge or
an investigating officer would probe first.

| PS capability | Today | Evidence |
| --- | --- | --- |
| Receive a complaint | **Done (Phase 1).** `POST /api/complaints` creates the case, anchors its synthetic records to the complaint time, and ranks locations in one request. | §1.1, §1.4. |
| Rank cash-out locations | **Done**, surface + zones shipped; serving geometry re-aligned so all eight demo cities stay banded. | `14ef942`, `eb38afb`; §3.1.1. |
| Say *when* the cash-out is expected | **Removed (Phase 1); measurement negative (Phase 2).** No predicted window or lead time is shown; screens describe the records on file, and the first cash-out hour is not predictable from complaint-time features. | §1.2, §1.4, §2.1. |
| Jurisdiction-correct access | **Done for reads and writes.** Department scope plus an account district on every case-owned read and write; complaint intake refuses another district and re-authorizes replays. | `visibility_filter`, `require_case`; §3.2.1. |
| Alerting at scale | **Partly.** Durable dispatch exists; outbound published and signed; 8,000/day measured at ~3× headroom, in-process and SQLite (see the caveats). | §3.3.1, §3.4.1, `docs/LOAD_BENCHMARK.md`. |
| Fund blocking | **Request built (not a freeze).** `POST /api/cases/{id}/block-request` records a tokenised account, audits it, and publishes `alert.blocked` over the signed webhook; no bank action is claimed. | §3.5. |

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

**The finding.** Serving builds most of the row model's inputs at case level
(`amount`, `num_mule_accounts`, `hour`, velocity), so every ATM in a case gets a
similar score. Measured on the fitted artifacts, fraud rows score 68.6–99.2
(p50 97.1) and legitimate rows 15.1–22.8 (p50 19.1) — the earlier "training rows
9.7–32.2" figure was the legitimate-row band. A complaint is a reported fraud,
so a served 88–99 is in band, not a serving bug. The number still tracks the
case, not the location: it is severity, not a per-ATM chance. That is also why
the surface is built on `ranker_score`, the model that only sees ATM-level
features. See `docs/SERVING_ALIGNMENT.md`.

Phase 1 changes wording only; the serving inputs are fixed in §3.1.

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
- Intake is covered by `backend/tests/test_complaints_intake.py` (23 tests):
  create, replay, `409`, `422`, CSRF, auth, district authority, department
  ownership, record anchoring, category canonicalisation and observed-window shape.
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

### 2.1 As measured (negative)

`backend/measure_lead_time.py` runs the protocol above. On 143 group-holdout
rings the model hits the first cash-out hour within ±1h in 69.2% of cases, against
a permutation mean of 71.3% (p = 0.82); always answering 18:00 scores 80.4%. On
the union of all holdouts (429 rings) the model gets 73.9% against 74.1%
(p = 0.59), and the modal hour again wins at 80.7%. The feature list excludes
`hour` and `time_window_match`, and a test pins that exclusion.

The generator draws ring hours from the evening window independently of the
complaint-time features, so there is nothing beyond the marginal evening prior
to learn. No lead time is reported: `avg_lead_time` stays "not measured", the
observed window stays descriptive, and the next honest step is timestamped
complaint/cash-out outcome logs, not another model. Details in
`docs/LEAD_TIME_MEASUREMENT.md`.

---

## 3. Phase 3 — serving alignment, then trust and load

### 3.1 Align `risk_score` serving features with training
Serve the mule-account and withdrawal-frequency features from the distribution
training actually saw, or retrain against the serving distribution — not both at
once, so the cause stays attributable. Acceptance: the eight demo cities show
within-city spread again, and no city falls flat at the band floor the way
Hyderabad does today (`risk_surface.py` `FLAT_EPS`). Re-verify the surface and the
DBSCAN zones after the change, because both consume the same payload.

#### 3.1.1 As built

Measurement first (`docs/SERVING_ALIGNMENT.md`) changed the diagnosis. The row
score was **not** out of band: the fitted model puts fraud rows at p50 97.1
(p05 68.6), so serving a reported fraud at 88–99 is in distribution. The real
defect was the ranker surface: with the victim pinned to the city centre every
Hyderabad ATM fell outside the ranker's 3.07 km positive region, scored exactly
`0.0`, and the surface was flat.

Four serving-side causes were fixed, all by serving what training saw:

1. The synthetic victim is anchored to a deterministic registry ATM 0.4–1.6 km
   away (trained fraud distance p05–p60) instead of the city centre; the suspect
   sits 0.5–4.0 km from the victim.
2. `hour` is the circular mean of the observed record hours, so a window across
   midnight no longer averages to daytime and `time_window_match` can fire.
3. `atm_type_score` and `historical_crime_density` come from the registry's type
   and risk instead of case-id hashes (`0.55`/`0.85` type values and a `1–14`
   density were never in the training set).
4. The model sees `num_mule_accounts` clamped to 1–8 and
   `recent_withdrawal_freq` from the ATM's registry risk, not the filed linked
   account count.

Left unchanged on purpose: `atm_cashout_history` (the fixture has only a few
records per ATM — a cold start, not a bug) and the filed `amount` (a complaint
fact; clamping it would hide drift).

Re-verified on the seeded 30-case database: the eight district cases
(`CC-2026-0147`, `0201–0207`) each keep a ranker spread of 0.185–0.839, no
surface is flat, each keeps at least one priority cell, and DBSCAN still emits
1–5 zones. `python perturb_ranker.py --no-write` still prints
`baseline 0.9068`. Protocol guards live in
`backend/tests/test_serving_alignment.py` (5 tests).

### 3.2 `role × district` RBAC

Reads are scoped by `visibility_filter` and `require_case`, but on `department`:
users carry no district field, so there is no district predicate to enforce yet.
The first step is a `users.district` column and a demo backfill; then the same
scope applies to writes: `POST /api/alerts`, `POST /api/alerts/{id}/acknowledge`,
`POST /api/alerts/{id}/notify`, `POST /api/cases/{id}/resolve`,
`POST /api/cases/{id}/action`, and `POST /api/complaints`.

#### 3.2.1 As built

`users.district` (migration `0008_user_district`, default `""`). Empty means a
**national** account, which is what every existing user was, so adding the column
took nothing away. A named district restricts the account to cases filed under
it; the district name must match `cases.district` exactly, and intake already
validates it against the eight registry districts.

The predicate lives in `access_control.visibility_filter`: the existing
department clause is unchanged, and a district account adds
`Case.district == user.district` as a second condition. That is the whole write
story, because every case-owned write already resolves its case through
`require_case`: alerts create/acknowledge/notify, resolve, action, transactions,
review and field outcomes inherit the scope without a second rule. A case with no
recorded district is in no district and is therefore invisible to a district
officer — the alternative is guessing a jurisdiction, which is what the column
exists to prevent.

Two findings came out of the write audit:

1. **`external_ref` replay bypassed visibility.** The replay path looked the case
   up by reference, not by an id the caller had been authorised for, and returned
   that case and its prediction. It now calls `require_case` before replaying, so
   a reference that belongs to another district or department is refused instead
   of disclosed.
2. **The plan's 403 acceptance was an existence oracle.** For a case the officer
   cannot see, a 403 confirms the id exists. Cross-district case requests
   therefore answer **404**, matching how reads already behaved; 403 is kept for
   role denials on cases the officer *can* see, and for intake, where no case
   exists yet and there is nothing to leak.

Demo: `INS-002` (`inspector.puducherry@atlas.gov`) is scoped to Puducherry; the
four original demo accounts stay national so the multi-city demo still works.

Limits: district assignment is a seeded/manual data task — there is no admin API
to move a user between districts, and registration never sets one, so a
self-registered account is national until someone scopes it. That is the same
exposure every account had before this revision, not a new bypass.

Verified by `backend/tests/test_district_rbac.py` (11 tests): own-district list,
cross-district read/resolve/action/alert create/acknowledge/notify refused with
no side effect, cross-district complaint 403, a replayed reference refused, and the same
officer still resolving and filing inside Puducherry.

### 3.3 Signed outbound webhook
HMAC-SHA256 over `timestamp.body`, retry with backoff, dead-letter on exhaustion —
the durable dispatch already has the queue. No secret in logs, no unsigned
fallback.

#### 3.3.1 As built

`webhook_client.send_webhook` — third channel beside SMS/email, in the same
`notification_jobs` queue, so retry, backoff and dead-letter are inherited rather
than re-implemented:

```
POST <ALERT_WEBHOOK_URL>
X-ATLAS-Timestamp: <unix seconds>
X-ATLAS-Signature: sha256=<hex hmac of "<timestamp>.<exact body bytes>">
X-ATLAS-Event: alert.created | alert.notified
```

The timestamp is inside the signed material, so a captured request cannot be
replayed later without failing a freshness check (300 s, in `verify_signature`,
the executable statement of the contract used by the tests). Each retry is
signed again with a fresh timestamp.

Two findings from the audit of the existing carriers:

1. **A missing secret would have been sent by default.** SMS/email both log
   "skipping" and return False, and the queue retries them — that is the safe
   failure. For a webhook the same code would have published an alert nobody
   could authenticate, which is worse than not publishing it. So there is no
   unsigned fallback: no URL or no secret → `send_webhook` returns False, and
   `_dispatch_guard` refuses to enqueue at all, so nothing writes doomed jobs.
2. **The phone's cooldown does not belong to a machine.** Cooldown and caps exist
   to stop spamming one investigator. A partner endpoint is not a phone, so
   webhook gets its own cap (500/day) and no cooldown, while SMS/email keep
   45 min and 2/day.

Secrets are never logged and never stored: logs name the URL host and status;
the connection error is reduced to its type, and `last_error` never sees the
secret. The payload is the alert envelope only — `alert_id`, `case_id`, message,
risk band, location, district, observed span, timestamp, acknowledged — no
score and no probability. The job row carries no signature; the sender signs at
send time, so a stored job cannot be replayed as sent.

Limits: one fixed URL and secret per deployment (no per-district routing), no
inbound verification endpoint, and no idempotency key on the receiver side —
retries after a 2xx the receiver failed to record can redeliver, which the
`alert_id` makes safe to deduplicate.

Verified by `backend/tests/test_signed_webhook.py` (13 tests): signature matches
a hand-rolled HMAC over `timestamp.body`, the timestamp is covered, stale and
forged signatures fail, nothing leaves the process without a secret or a URL,
2xx / non-2xx / network error are handled, queue + dead-letter behave, and
`/api/alerts/{id}/notify` reports the webhook skipped when unconfigured and
queued when configured.

### 3.4 8,000 complaints/day
Replay the intake endpoint at that rate against a local instance and report p50
and p95, plus where the time goes. Report the number even if it is bad; measuring
first is the point.

#### 3.4.1 As measured

`docs/LOAD_BENCHMARK.md`. 1,000 sequential real `POST /api/complaints` against
a scratch SQLite database, all dispatch disabled:

- 1,000/1,000 ok; p50 **3,399 ms**, p95 **4,021 ms**, p99 4,583 ms, max 6,595 ms
- Throughput 0.3/s ≈ 24,986/day equivalent; 8,000/day needs 0.093/s, so **~3× headroom** on one process
- 1,000 cases · 12,000 transaction records · 1,000 predictions · 8,000 ranked locations; DB 70.7 MB

**Where the time goes:** validate 0.02 ms, insert+audit+records 30 ms,
predict 5,617 ms mean, persist 63 ms, alert 9 ms, respond 3,043 ms. Inside
predict, `_predict_or_503` → `predict_cashout` is 585 s of 664 s cumulative,
but the trees contribute only ~16 s of `predict_proba`; the rest is
`multiprocessing.pool._wait_for_updates` / `thread.join` — thread/process
synchronisation overhead, not model work. Serialising the same model work
without a pool is the obvious next step. `_current_model_fingerprint`
(joblib.hash over both models and the SHAP background) adds ~40 s across
1,080 calls — cheap next to predict, but as large as all SQL in the request.

**Caveats, which are part of the answer:**

1. In-process, not over HTTP: TestClient calls the ASGI app in one process, so
   this is code-path latency, not client-observed network latency.
2. SQLite, not Postgres: this measured the code path, not a database backend.
   On Postgres the shape changes, and a deployed instance must be re-measured.
3. One process, one machine. No worker scaling was measured; the next useful
   run measures *concurrent* intake, not only sequential throughput.
4. "24,986/day" is the measured rate × 86,400, a capacity equivalence, not an
   observed day.

**No number was invented and no run was discarded.** The first run of the
probe died after 1,084 complaints because the access token expired (a real
30-min JWT) and the remainder were 401s — that was the script's bug, and the
run is not cited anywhere; it is noted here because the next person will
re-run this script and should know why it re-logs in. The corrected probe
re-logs in automatically and reports its session count.

### 3.5 Fund-block request

`POST /api/cases/{id}/block-request`, `202`. Answers *"enabling faster fund
blocking"* the honest way: the endpoint **requests** that one mule account be
frozen; it does not freeze anything and never claims a bank acted.

- `to_account` is a tokenised reference (`SYN-MULE-042` form); raw account
  numbers (pure digits ≥8, spaces, email shapes) are `422`. The prototype
  carries synthetic tokens; the bank replaces the token at its desk.
- District guard is `require_case(..., 'write')` — cross-district is **404**
  with no job, no audit, no side effect.
- On the signed channel, event `alert.blocked`, kind `webhook`, same HMAC /
  retry / dead-letter path as alerts (§3.3.1). Unconfigured webhook queues
  nothing, sends nothing unsigned.
- Human framing on the response and payload: *"Block request recorded for
  human review; no bank action has been taken."* No probability, no score.
- Audit `Block Requested` per request. Wire proof for the signed delivery is
  `backend/tests/test_webhook_wire.py` (real HTTP listener); end-to-end
  via `tests/test_block_request.py`.
- **Rides the existing durable dispatch — no parallel path.** `_dispatch_guard`
  + `enqueue_notification` + `run_notification_worker` is the same code the
  alert paths call, so bank-down semantics are identical for alerts and
  block-requests: non-2xx and timeouts retry, exhaustion dead-letters.
- **Known limit:** `send_webhook` treats any 2xx as delivered and does not
  inspect the body. A bank answering 200 with `{"status": "rejected"}` would
  be marked sent here. A refusal must therefore come back non-2xx (or via a
  follow-up status check) for the queue to act on it. Pinned by
  `test_block_request_200_with_rejected_body_counts_as_delivered` so a future
  body-check is a deliberate, reviewable change.

Verified by `backend/tests/test_block_request.py` (11 tests). The lead-time
anchor was checked at the same time: intake sets `created_at=incident_at`
explicitly (`main.create_complaint`), so the Phase 2 negative rests on the
complainant's stated time, not the DB default — see
`docs/LEAD_TIME_MEASUREMENT.md` "Anchor check".

---

## 4. Phase 4 — packaging
Strategic intel brief (one page), one continuous loop on screen
(complaint → prediction → zone → alert → resolve), noise cleanup including the
`ws://localhost:8000/ws/alerts … 403` console error, and slide copy discipline —
`FIGHT_CLUB` and `164305` only, no model metrics, no member names.

#### 4.1 As built (WS 403 already shipped as `5c6a5a9`)

- **Brief:** `docs/STRATEGIC_BRIEF.md` — one page, loop diagram, what ATLAS
  proves / does not prove, links. No model metrics, no member names, no
  probabilities, no lead time.
- **Loop page:** `frontend/src/pages/LoopPage.tsx`, routes `/real/loop` and
  `/demo/loop`, nav item "Loop" in `FloatingDockNav.tsx`. Five steps advance
  every 3 s (hover/focus pauses), reading live dashboard state: complaint
  district/category/amount, prediction primary ATM + zone/rank + observed
  span, intervention zones, alerts for the case, and Resolve (human action
  only — demo mode never calls the API; role check via `can('case.resolve')`).
  Empty state asks the user to pick a case in Cases; no invented data.
- **Copy/slide discipline:** not in code scope — the PPT is owner-managed.
  Verified against code: no `FIGHT_CLUB`/`164305` strings in frontend docs
  copy, no member names; the brief and loop page carry no model metrics.

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
# serving alignment: geometry, circular hour, registry attributes, no flat city
cd backend; python -m pytest tests/test_serving_alignment.py -q
# district RBAC: refusal without side effect, replay re-authorized
cd backend; python -m pytest tests/test_district_rbac.py -q
# signed webhook: signature contract, no unsigned fallback, dead-letter
cd backend; python -m pytest tests/test_signed_webhook.py -q
# webhook wire probe: real HTTP listener, wire bytes verify at the receiver
cd backend; python -m pytest tests/test_webhook_wire.py -q
# block-request: tokenised account, district guard, alert.blocked, no bank claim
cd backend; python -m pytest tests/test_block_request.py -q
# 8,000/day load: 1,000 sequential intakes, report p50/p95 and where the time goes
# measurement only — writes docs/LOAD_BENCHMARK.md @ 3.4.1, sqlite scratch DB
# frontend
cd frontend; npm test; npx tsc --noEmit; npm run lint
# fixture guarantee: prints the sweep without rewriting the committed report;
# baseline@42 must still read 0.9068
cd backend; python perturb_ranker.py --no-write
```

Plus a live pass on `/real/map` and `/real/cases` for the screen claims, and a
`curl` replay of the intake contract before it is described in any deck.
