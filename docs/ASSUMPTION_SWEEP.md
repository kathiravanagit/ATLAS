# Generator assumption sweep

One data-generating assumption is broken at a time, the world is regenerated
from `backend/generate_data.py`, and the two shipped retrieval paths are scored
on the same holdout ring IDs. Nothing is retrained: each number is what a model
fitted under the original assumptions scores when that assumption is false.

429 holdout ring-cases per world. Every assumption is drawn at three seeds
(42/7/13) and compared with the *unmodified* generator at the same seed, so the
delta is the knob and not a different sample; the mean over the three draws is
what the table reports.

Independent draws of the unmodified generator scored ranker Hit@3 0.874–0.937 and ensemble Hit@3 0.296–0.352 across 6 seeds. That spread sets the band (±0.037 ranker, ±0.032 ensemble); a knob inside it is not evidence of a dependence, and one outside it is.

The unit of comparison is the rate, not the case. Two unmodified draws already place 65–89 of 429 ranker cases (15–21%) on the other side of Hit@3, and 179–208 for the ensemble, because each world plants a different ring ATM. A paired case-level test would measure the draw rather than the assumption, which is why every verdict is read off the rate.

## Serving ranker (A2.1, what orders candidates at request time)

| Assumption | What changed | Hit@3 per draw | Mean Hit@3 | Mean Δ | Δ range | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `baseline` | the generator as shipped | 0.907 / 0.895 / 0.881 | 0.894 | +0.000 | +0.000 to +0.000 | baseline |
| `timing_removed` | ring hours uniform over the day; evening terms dropped from the outcome logit | 0.897 / 0.881 / 0.911 | 0.897 | +0.002 | +0.000 to +0.005 | within noise (±0.037) |
| `ring_size_x2` | every crime type's mule_range doubled | 0.895 / 0.883 / 0.907 | 0.895 | +0.001 | +0.000 to +0.002 | within noise (±0.037) |
| `amount_wide` | loss amounts ~2x wider for both fraud and legitimate rows | 0.895 / 0.883 / 0.909 | 0.896 | +0.002 | +0.000 to +0.002 | within noise (±0.037) |
| `amount_flat` | one lognormal for every row; amount independent of crime type | 0.897 / 0.883 / 0.909 | 0.897 | +0.002 | +0.002 to +0.002 | within noise (±0.037) |
| `geography_jitter_250m` | every ATM coordinate moved by 250 m of Gaussian noise | 0.904 / 0.916 / 0.900 | 0.907 | +0.012 | -0.007 to +0.035 | within noise (±0.037) |
| `geography_jitter_1000m` | every ATM coordinate moved by 1 km of Gaussian noise | 0.937 / 0.909 / 0.900 | 0.915 | +0.021 | -0.007 to +0.042 | within noise (±0.037) |
| `label_noise_5pct` | 5% of drawn cash-out outcomes flipped before they enter ATM history | 0.900 / 0.879 / 0.914 | 0.897 | +0.003 | -0.002 to +0.007 | within noise (±0.037) |
| `label_noise_10pct` | 10% of drawn cash-out outcomes flipped before they enter ATM history | 0.900 / 0.883 / 0.916 | 0.900 | +0.005 | +0.002 to +0.009 | within noise (±0.037) |
| `candidate_pool_5` | 5 candidates per case instead of 15 — a different task, not a broken assumption | 0.988 / 0.993 / 0.984 | 0.988 | +0.094 | +0.077 to +0.112 | not comparable (chance 0.600) |
| `candidate_pool_50` | 50 candidates per case instead of 15 — a different task, not a broken assumption | 0.860 / 0.849 / 0.876 | 0.862 | -0.033 | -0.035 to -0.030 | not comparable (chance 0.060) |

Largest mean move from any of the 8 broken assumptions: +0.021 (`geography_jitter_1000m`), against a ±0.037 band from independent draws.

Two standard errors of the baseline Hit@3 (n=429) is 0.0281.

## Row-ensemble retrieval (fallback when the ranker artifact is absent)

| Assumption | What changed | Hit@3 per draw | Mean Hit@3 | Mean Δ | Δ range | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `baseline` | the generator as shipped | 0.331 / 0.303 / 0.352 | 0.329 | +0.000 | +0.000 to +0.000 | baseline |
| `timing_removed` | ring hours uniform over the day; evening terms dropped from the outcome logit | 0.347 / 0.373 / 0.354 | 0.358 | +0.029 | +0.021 to +0.044 | within noise (±0.032) |
| `ring_size_x2` | every crime type's mule_range doubled | 0.329 / 0.322 / 0.303 | 0.318 | -0.011 | -0.030 to +0.026 | within noise (±0.032) |
| `amount_wide` | loss amounts ~2x wider for both fraud and legitimate rows | 0.329 / 0.345 / 0.336 | 0.337 | +0.008 | -0.007 to +0.026 | within noise (±0.032) |
| `amount_flat` | one lognormal for every row; amount independent of crime type | 0.336 / 0.308 / 0.310 | 0.318 | -0.011 | -0.044 to +0.033 | within noise (±0.032) |
| `geography_jitter_250m` | every ATM coordinate moved by 250 m of Gaussian noise | 0.308 / 0.340 / 0.319 | 0.322 | -0.006 | -0.012 to +0.005 | within noise (±0.032) |
| `geography_jitter_1000m` | every ATM coordinate moved by 1 km of Gaussian noise | 0.322 / 0.345 / 0.338 | 0.335 | +0.006 | -0.007 to +0.019 | within noise (±0.032) |
| `label_noise_5pct` | 5% of drawn cash-out outcomes flipped before they enter ATM history | 0.291 / 0.336 / 0.340 | 0.323 | -0.006 | -0.016 to +0.009 | within noise (±0.032) |
| `label_noise_10pct` | 10% of drawn cash-out outcomes flipped before they enter ATM history | 0.291 / 0.322 / 0.329 | 0.314 | -0.015 | -0.030 to -0.002 | within noise (±0.032) |
| `candidate_pool_5` | 5 candidates per case instead of 15 — a different task, not a broken assumption | 0.613 / 0.618 / 0.636 | 0.622 | +0.294 | +0.266 to +0.310 | not comparable (chance 0.600) |
| `candidate_pool_50` | 50 candidates per case instead of 15 — a different task, not a broken assumption | 0.207 / 0.212 / 0.212 | 0.211 | -0.118 | -0.140 to -0.096 | not comparable (chance 0.060) |

Largest mean move from any of the 8 broken assumptions: +0.029 (`timing_removed`), against a ±0.032 band from independent draws.

Two standard errors of the baseline Hit@3 (n=429) is 0.0454.

## Manipulation check (the world moved, at seed 42)

| Assumption | Rings | Candidates/case | Cash-out rate | Ring rows 17-22 | Mean mules | Mean amount | Mean ATM history |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline` | 1000 | 15 | 0.0420 | 0.846 | 3.23 | 64028 | 0.2019 |
| `timing_removed` | 1000 | 15 | 0.0414 | 0.261 | 3.23 | 64028 | 0.2119 |
| `ring_size_x2` | 1000 | 15 | 0.0420 | 0.846 | 6.46 | 64028 | 0.2006 |
| `amount_wide` | 1000 | 15 | 0.0420 | 0.846 | 3.23 | 198169 | 0.2000 |
| `amount_flat` | 1000 | 15 | 0.0420 | 0.846 | 3.23 | 27675 | 0.2023 |
| `geography_jitter_250m` | 1000 | 15 | 0.0419 | 0.846 | 3.23 | 64028 | 0.2017 |
| `geography_jitter_1000m` | 1000 | 15 | 0.0419 | 0.846 | 3.23 | 64028 | 0.2017 |
| `label_noise_5pct` | 1000 | 15 | 0.0887 | 0.846 | 3.23 | 64028 | 0.4254 |
| `label_noise_10pct` | 1000 | 15 | 0.1342 | 0.846 | 3.23 | 64028 | 0.5877 |
| `candidate_pool_5` | 1000 | 5 | 0.0420 | 0.846 | 3.23 | 64028 | 0.2019 |
| `candidate_pool_50` | 1000 | 50 | 0.0420 | 0.846 | 3.23 | 64028 | 0.2019 |

The timing row is the proof the knob bit: the ring evening share falls from 0.846 to 0.261 while the ring count (1000 vs 1000), mean mule count (3.23 vs 3.23) and mean amount (64028 vs 64028) are unchanged. The ring-size and label-noise rows move their own column the same way, so no delta above is a mixture of knob effect and a redrawn world.

## What this means

No single broken assumption moves the serving ranker's Hit@3 beyond the control band. The largest mean move is +0.021 (`geography_jitter_1000m`) against a ±0.037 band.

No single broken assumption moves the ensemble fallback's Hit@3 beyond the control band. The largest mean move is +0.029 (`timing_removed`) against a ±0.032 band.

That is a bound, not an all-clear. The serving ranker's nine features are all
ATM-varying, so a case-level assumption can only reach it through
`atm_cashout_history` — a knob that leaves that column alone cannot move the
ranking in principle, and the columns each knob touches are listed in the
manipulation table above. What the sweep rules out is large sensitivity to these
8 settings; it does not show that no assumption anywhere matters, and
it says nothing about real ATMs.

## Scope

These numbers describe a simulator and a frozen synthetic model. They bound how
far the retrieval score moves when a generator assumption is false; they are not
real-world next-ATM accuracy, not a calibration statement, and no probability is
attached to any of them. The candidate-pool rows are a harder or easier task, not
a broken assumption, and are labelled as such.
