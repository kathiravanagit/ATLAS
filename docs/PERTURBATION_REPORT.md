# Ranker perturbation report

Synthetic evaluation of the two frozen retrieval paths on the same holdout cases,
with one input altered per row. Nothing is retrained and no weights change; the
artifacts are scored exactly as shipped.

## Serving ranker (A2.1, what orders candidates at request time)

| Perturbation | What changed | Hit@1 | Hit@3 | Hit@5 | Mean rank | MRR | Δ Hit@3 | vs noise |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `baseline` | no change | 0.692 | 0.907 | 0.958 | 1.68 | 0.807 | +0.000 | noise |
| `victim_offset_250m` | complaint coordinate moved 250 m north-east | 0.702 | 0.895 | 0.958 | 1.72 | 0.807 | -0.012 | noise |
| `victim_offset_1km` | complaint coordinate moved 1 km north-east | 0.639 | 0.876 | 0.944 | 1.87 | 0.769 | -0.030 | larger than noise |
| `hour_plus_one` | reported hour is one hour late | 0.692 | 0.907 | 0.958 | 1.68 | 0.807 | +0.000 | noise |
| `hour_off_window` | reported hour outside the 17-22 window | 0.692 | 0.907 | 0.958 | 1.68 | 0.807 | +0.000 | noise |
| `amount_doubled` | reported loss doubled | 0.692 | 0.907 | 0.958 | 1.68 | 0.807 | +0.000 | noise |
| `mules_plus_two` | two more linked mule accounts | 0.692 | 0.907 | 0.958 | 1.68 | 0.807 | +0.000 | noise |
| `withdrawal_history_dropped` | past-month ATM cash-out history unavailable | 0.690 | 0.916 | 0.979 | 1.62 | 0.809 | +0.009 | noise |
| `crime_density_zeroed` | registry crime density unavailable | 0.550 | 0.835 | 0.944 | 2.05 | 0.710 | -0.072 | larger than noise |
| `atm_type_unknown` | ATM type missing from the registry | 0.706 | 0.909 | 0.965 | 1.68 | 0.812 | +0.002 | noise |

429 holdout ring-cases, 15 candidates each (chance-level Hit@3 is 0.200). Two standard errors of the baseline Hit@3 is 0.0281; a smaller delta is sampling noise.

## Row-ensemble retrieval (fallback when the ranker artifact is absent)

| Perturbation | What changed | Hit@1 | Hit@3 | Hit@5 | Mean rank | MRR | Δ Hit@3 | vs noise |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `baseline` | no change | 0.182 | 0.331 | 0.436 | 7.48 | 0.324 | +0.000 | noise |
| `victim_offset_250m` | complaint coordinate moved 250 m north-east | 0.177 | 0.338 | 0.443 | 7.37 | 0.324 | +0.007 | noise |
| `victim_offset_1km` | complaint coordinate moved 1 km north-east | 0.182 | 0.336 | 0.471 | 7.12 | 0.329 | +0.005 | noise |
| `hour_plus_one` | reported hour is one hour late | 0.179 | 0.305 | 0.427 | 7.62 | 0.317 | -0.026 | noise |
| `hour_off_window` | reported hour outside the 17-22 window | 0.217 | 0.368 | 0.459 | 7.14 | 0.357 | +0.037 | noise |
| `amount_doubled` | reported loss doubled | 0.196 | 0.345 | 0.459 | 6.92 | 0.343 | +0.014 | noise |
| `mules_plus_two` | two more linked mule accounts | 0.140 | 0.280 | 0.396 | 8.04 | 0.282 | -0.051 | larger than noise |
| `withdrawal_history_dropped` | past-month ATM cash-out history unavailable | 0.144 | 0.268 | 0.366 | 8.11 | 0.283 | -0.063 | larger than noise |
| `crime_density_zeroed` | registry crime density unavailable | 0.179 | 0.333 | 0.427 | 7.72 | 0.320 | +0.002 | noise |
| `atm_type_unknown` | ATM type missing from the registry | 0.170 | 0.305 | 0.396 | 8.03 | 0.306 | -0.026 | noise |

429 holdout ring-cases, 15 candidates each (chance-level Hit@3 is 0.200). Two standard errors of the baseline Hit@3 is 0.0454; a smaller delta is sampling noise.

## Reading it

The two paths fail differently, and the difference is the argument for the A2.1
ranker. The serving ranker sees only ATM-varying evidence, so the case-level inputs
— reported hour, amount, mule count — change its ranking by exactly nothing; a
candidate's rank is decided by where it is relative to the complaint and what the
registry says about it. The ensemble fallback scores cases rather than ATMs, and
there the case-level inputs do move the answer: adding two mule accounts costs it
~5 points of Hit@3. A signal that is identical for every candidate reordering the
candidates is the failure mode the dedicated ranker exists to prevent.

What the serving ranker does depend on is registry and geography, and the table
quantifies the cost: a 1 km error in the complaint coordinate is above the noise
band, and a registry with missing crime density costs ~7 points of Hit@3. Those are
the inputs to harden before any pilot, because they are the ones the rank actually
rests on.

The past-month cash-out history splits the two paths: the ensemble leans on it, the
serving ranker does not (it scores marginally better without it, within noise). The
honest conclusion is that the ranker's edge comes from geometry and registry data,
not from ATM history — which is worth knowing before anyone promises behavioural
signal.

These numbers describe the synthetic simulator, not real ATM selection accuracy. They
are uncalibrated and say nothing about the probability of a real cash-out.
