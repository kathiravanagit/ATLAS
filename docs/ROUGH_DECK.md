# ATLAS — rough deck (5 slides)

Rough deck text. Slide 2 is the disclosure we lead with. Do not re-order.

## 1. What ATLAS does

- Complaint in → ranked cash-out locations out → intervention zones → signed alert → human decision.
- Intake is `POST /api/complaints`: case created, synthetic records anchored to `incident_at` (`created_at = incident_at`, verified), locations ranked in one request.
- Ranked locations + risk surface + zones grouping adjacent priority/watch cells into areas to check. Rank is relative order — not a probability, not calibrated.
- Outbound alert is HMAC-signed over `timestamp.body`, retried, dead-lettered. No unsigned fallback. 8,000 complaints/day measured at ~3× headroom — SQLite, in-process, caveats disclosed.

## 2. Where's the forecast — we measured; it wasn't there

The PS title verb is honest: we measured whether the first cash-out hour is predictable, and on this synthetic schedule it is not.

- Model ±1h: **0.692** (group holdout) / **0.739** (group+time+location)
- Permutation mean: **0.713 / 0.741**, 95th 0.755 / 0.765
- **p = 0.824 / 0.588** — model does not beat a permutation of its own predictions
- Modal baseline — `"cash-out is most likely at 18:00"` — wins at **0.804 / 0.807**, beating every model prediction

What this means: the generator draws ring hours from the evening window per member, independently of amount, mule count, city, crime type, and geography. Features carry no information beyond the marginal evening prior. A model fitted to that learns the distribution, not a case-level signal.

What we will not do: show a predicted window or lead time. No lead-time UI, no alert wording with hours, no single number. The observed window stays descriptive.

What would change the answer: a log pairing each complaint's filing time with the time of the first confirmed cash-out, on cases the model did not train on (see `docs/VALIDATION_PLAN.md` §2). Reproduce: `cd backend && python measure_lead_time.py`.

The framework is built. The data requirement is named. That disclosure is the strongest thing in the repo.

## 3. What it does not do

- No bank action. Block-request is a signed *request*: response verbatim — **"Block request recorded for human review; no bank action has been taken."** Payload says the same. The fraud desk decides.
- Known limit, stated before you ask: a bank returning `200` with a rejected body counts as delivered; refusal must come back non-2xx or via status check. Documented in PS_GAP_PLAN §3.5.
- No real data. Synthetic only, labelled on every screen. Nothing here connects to a live crime, banking, or government database.
- No autonomous action, no predicted window, no calibrated probability.

## 4. What's built (evidence, not claims)

| Claim | Where to check |
|---|---|
| Intake, honest time, labels | `POST /api/complaints`, PS_GAP_PLAN §1 |
| Role × district RBAC, refusal without side effect | `require_case`, §3.2.1 |
| Signed webhook, wire probe | `webhook_client`, `tests/test_signed_webhook.py`, `tests/test_webhook_wire.py` |
| Block-request backend | `POST /api/cases/{id}/block-request`, `b41b7ed` (11 tests: 500→retry→dead-letter, timeout queued-not-sent, 200-rejected pinned) |
| Load | `docs/LOAD_BENCHMARK.md` (1,000 sequential intakes, p50/p95) |
| Loop page + brief | `/real/loop`, `/demo/loop` (`LoopPage.tsx`) |

## 5. What's next (the gap to 8.5)

1. **Block-request on screen** — button on `CaseDetail`, token from the case's linked accounts (no free-text, no 422 on camera); receiver prints `signature OK` next to the browser.
2. **I4C aggregation view** — on top of district RBAC: national role sees counts across districts, not case detail.
3. **Campaign query** — `GROUP BY to_account ≥ 2 cases`, table, labelled synthetic. Hit count sanity-checked before it goes on screen.
4. **Rough desktop take, then polished re-record.**

Still capped below 9: the PS title verb is honestly not met, and we say so.
