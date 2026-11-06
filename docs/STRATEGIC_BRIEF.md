# ATLAS — Strategic Brief (one page)

**Team FIGHT_CLUB · SIH 2026 · PS 26184.** ATLAS — Advanced Threat Location &
Alert System. A synthetic-data prototype; not connected to any live crime,
banking, or government database.

## The problem

A cybercrime complaint arrives and the investigator must decide **where** the
money will be cashed out. Today the registry has no ordering: every ATM looks
the same and nothing says which to check first. The *when* is a trap — Phase 2
measured it and found it is not predictable from complaint-time features
(`docs/LEAD_TIME_MEASUREMENT.md`), so ATLAS never prints a predicted window or
a lead time. It shows the records already on file instead.

## What ATLAS does

One intake endpoint creates the case, anchors its records to the complaint
time, and ranks locations — in a single request. The loop below is live on
screen (`LoopPage.tsx`); it is not a slide.

```
Complaint  ──→  Prediction  ──→  Zone  ──→  Alert  ──→  Resolve
  (Cases)        (Predictions)     (Map)      (Alerts)     (Cases)
    district,      ranked ATMs,     priority/  one alert   acknowledge /
    category,      no predicted     watch      per case+ATM resolve
    amount         window                                    only on a
                                                       human action
```

Verified properties: district-scoped access on reads **and** writes, with a
`external_ref` replay that re-authorises instead of leaking another district's
case; outbound alerts published as a signed webhook (HMAC, retry, dead-letter,
no unsigned fallback); every city keeps a banded ranking surface; and intake
replayed at 1,000 sequential requests passed 1,000/1,000 with ~3× headroom
for 8,000/day. Numbers and caveats are in `docs/LOAD_BENCHMARK.md`.

## What it does not prove

- **No model accuracy claim.** The ranker is trained on a synthetic generator,
  shown as a rank — never a probability, never labelled "accurate".
- **No lead time.** The measured answer is that the hour is not predictable
  from complaint-time features; the console says "Not measured".
- **No real data.** 23 curated + generated cases, 64 ATMs across 8 cities, all
  synthetic. The validation path (partners, censored outcomes, split protocol,
  acceptance criteria) is `docs/VALIDATION_PLAN.md` — proposal, not a result.
- **No automated enforcement.** Every alert needs a human to acknowledge,
  assign, escalate, or resolve. Predictions are decision support.

## Links

- Measurement log: `docs/PS_GAP_PLAN.md` (Phases 1–4), `docs/LEAD_TIME_MEASUREMENT.md`
- Serving evidence: `docs/SERVING_ALIGNMENT.md`, `docs/PERTURBATION_REPORT.md`,
  `docs/ASSUMPTION_SWEEP.md`
- Validation plan (not a claim): `docs/VALIDATION_PLAN.md`
