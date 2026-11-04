# ATLAS — 8,000 complaints/day: the measured number

Phase 3.4 (PS_GAP_PLAN.md §3.4). This is a measurement, not a claim, and
not a benchmark of a deployed instance.

**Method.** A scratch SQLite database was seeded with the 64-ATM registry and
the five demo users. Real `POST /api/complaints` calls were made through
`TestClient` against the real ASGI app — the whole request path, no network.
Dispatch was disabled (no provider credentials), so alerts were queued, not
sent. 1,000 complaints were filed sequentially. The script re-logs in when
the token is refused; it never skips a failure.

| Metric | 1,000-request measurement |
| --- | --- |
| Requests ok | 1,000/1,000, 0 failures |
| p50 | **3,399 ms** |
| p95 | **4,021 ms** |
| p99 | 4,583 ms |
| max | 6,595 ms |
| mean | 3,453 ms |
| Throughput | 0.3/s ≈ **24,986/day equivalent** |
| Rows written | 1,000 cases · 12,000 transaction records · 1,000 predictions · 8,000 ranked locations |
| DB file after | 70.7 MB |
| High-risk replies | 0/1,000 |
| Alert rows created | 1,119 (see the discrepancy note below) |

8,000/day is 5.6/minute = 0.093/s. At 0.3/s the measured code has **~3×
headroom** over the required rate on one machine, one process, one database.

## Where the time goes

A separate in-process profile of the same 120-request slice names the owner:

| Stage | p50 | p95 | mean |
| --- | --- | --- | --- |
| validate | 0.02 ms | 0.03 ms | 0.02 ms |
| insert + 12 synthetic records + audit | 26.6 ms | 32.8 ms | 30.3 ms |
| predict (per ATM, 8) | **5,558 ms** | **6,013 ms** | **5,617 ms** |
| — of which persist | 72.4 ms | 84.0 ms | 62.7 ms |
| — of which raise alert | 8.6 ms | 10.1 ms | 8.8 ms |
| respond | 3,045 ms | 3,188 ms | 3,043 ms |

Inside predict, `_predict_or_503` → `predict_cashout` accounts for 585 s of
664 s cumulative — and within that, the trees contribute only ~16 s of
`predict_proba`. The remainder (≈569 s) is `multiprocessing.pool`
`_wait_for_updates` / `threading.join` / `connection.wait`: **thread/process
synchronisation overhead**, not model work. Serialising the same model work
without a pool would remove most of it.

`_current_model_fingerprint` (joblib.hash over the two models and the SHAP
background) adds ~40 s cumulative across 1,080 calls — cheap relative to
predict but as large as all SQL in the request.

## What this does and does not say

1. **In-process, not over HTTP.** TestClient calls the ASGI app in one
   process. Loopback TCP is ~0.1 ms, so the dominant cost — predict — is the
   same over HTTP, but this is not a client-observed latency under a network.
2. **SQLite, not Postgres.** This measured the *code path*, not a database
   backend. On Postgres the shape changes (pooling, row locks) and the
   instance must be re-measured. A deployed number is not claimed here.
3. **One process, one machine.** No worker scaling was measured. 3× headroom
   at one process implies ample margin for 8,000/day, but it is not a
   concurrency guarantee: the next run should measure concurrent intake, not
   just sequential throughput.
4. **Arithmetic, not extrapolation.** "24,986/day" is the measured rate ×
   86,400. It is a capacity *equivalence*, not an observed day.

## Two discrepancies worth a look (not the latency cause)

- **0 high-risk replies, but 1,119 alert rows.** `_raise_high_risk_alert`
  fires on `risk_score > 70` (the alert band); the response's `risk_level`
  also reports High only above 70. The run produced alerts while reporting
  zero High replies — so the alert's primary score and the reply's reported
  band do not agree at this operating point, and the response is the one
  that reads "0/1000". Both read the same `primary["risk_score"]`; the
  difference must come from which path computes it. Worth tracing, and
  worth a test that pins alert-row creation against the reported level.
- **Persistence dominates SQL too.** `_persist_prediction` is 72 ms p50,
  larger than both per-request SQL and alert raising, because it rewrites
  the eight ranked-location rows for every prediction — the same write
  `_apply_rank_order` rewrites in memory. Batched snapshot rows (as
  `_persist_prediction` already writes) would be the next candidate.
