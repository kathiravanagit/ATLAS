# ATLAS — Validation Plan for Real Data

**Status: proposal, not a result.** No partner agreement, dataset or real-data
evaluation exists at the time of writing. This document describes how the model
would be validated *if* authorised data becomes available. It is the Phase 2
plan behind the synthetic prototype, not evidence that Phase 2 has happened.

Everything the current build reports is synthetic — see the model card and
`README.md`.

## 1. Data access and governance

- **Partners:** one public-sector bank (transaction and complaint data) and one
  state cybercrime cell or I4C channel (complaint and FIR context).
- **Framework:** a data-processing agreement under the DPDP Act 2023, with the
  bank's data-localisation and security requirements. The system runs inside the
  partner's environment; no copy is hosted elsewhere.
- **Minimisation:** no raw PII leaves the source. Account numbers are tokenised,
  names and contact details are redacted at ingest, and the model consumes
  amounts, timestamps, coarse geography and account-link structure only.

## 2. Data schema and outcome definition

- **Complaint:** timestamp, category, district, reported amount.
- **Transactions:** mule-account links, transfer timestamps, amounts.
- **Positive outcome:** a cash-out confirmed at ATM X inside window W for case C,
  taken from the bank's withdrawal log or the investigating officer's record.
- **Unconfirmed cases are not negatives.** A case with no confirmed cash-out is
  *censored*, not a known non-event: the withdrawal may have happened at another
  ATM, off-network, or not at all. Censored cases are excluded from supervised
  labels and reported separately. Treating them as negatives would inflate
  precision and hide real misses.

## 3. Split protocol

- **Group by city:** no account, ATM or ring appears in both train and test.
- **Forward in time:** train on months 1–6, test on 7–12, with the boundary fixed
  before fitting.
- **Split by ring, not by row:** rows from the same fraud ring never straddle the
  boundary.

## 4. Evaluation metrics

The primary measure is retrieval, not row classification.

- **Hit@1 / Hit@3 / Hit@5** — did the confirmed ATM appear in the top K for the case?
- **MRR** — how high the confirmed ATM ranked.
- **Candidates per case** — the list length an investigator actually has to review.
- **Recall at an operational alert budget** — of confirmed cash-outs, how many fell
  inside the top N alerts the partner can staff per day.

Classifier precision and recall are reported too, but as secondary, thresholded
numbers. They are not the product metric: a complaint already exists, and the
system's job is to order the candidate ATMs inside it.

## 5. Calibration and threshold policy

- Scores are uncalibrated ranks today, and the console presents them as ranks.
  The model card says so on every surface that shows a score.
- Before any probability is displayed, calibration (isotonic or Platt) is fitted
  on a held-out real slice and published with reliability curves and a Brier
  score. Until that report exists, the product stays rank-first.
- The alert threshold is a policy decision owned by the partner's risk operations
  team — the cost of an officer visit against the expected loss prevented. The
  system ships the threshold sweep; the partner chooses the operating point.

## 6. Acceptance criteria (proposed, fixed before the pilot)

These are targets, agreed with the partner before any result is seen. They are
not findings.

- **Hit@3 ≥ 65%** on unseen cities and future months.
- **Search-space reduction:** fewer than 10 candidate ATMs per case for manual review.
- **Alert load:** no more than 5 Critical alerts per city per day at the agreed threshold.
- **Calibration:** Brier score reported, and accepted by the partner.

If a target is missed, it is reported as missed.

## 7. Publication and transparency

Results are published whether they are positive or negative, against the protocol
above. If the model fails the criteria, the console, the security controls and the
evidence chain remain reusable; the weights are retired rather than defended.

## 8. What this plan does not claim

- No partner has signed, and no real dataset is held.
- No timeline is committed.
- Nothing here changes the current status: synthetic-only, uncalibrated,
  decision support for a human investigator.
