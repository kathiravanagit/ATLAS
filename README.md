# ATLAS — Advanced Threat Location & Alert System

[![CI](https://github.com/kathiravanagit/ATLAS/actions/workflows/ci.yml/badge.svg)](https://github.com/kathiravanagit/ATLAS/actions/workflows/ci.yml)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-2563eb)](./frontend)
[![Backend](https://img.shields.io/badge/backend-FastAPI-059669)](./backend)

## Smart India Hackathon 2026 — Problem Statement 26184

![ATLAS system architecture: data to ML, geospatial ranking, SHAP, alerts, blockchain evidence, and dashboard](assets/atlas-architecture.svg)

### Product tour

The console is organised around the complete investigation loop:

| Surface | What to look for |
| --- | --- |
| Dashboard | model status, ranked locations, notification count, and explicit unavailable/simulated metric labels |
| Ranked ATM map | city switching, time/risk filters, red high-risk zones, and the weighted heatmap |
| Explanation panel | exact selected-ATM inputs; ensemble SHAP when empirical background is available, otherwise clearly labelled global importance |
| Alert flow | high-risk predictions become reviewable alerts; acknowledgement is recorded |
| Blockchain evidence | hash-chain integrity, PoW status, Merkle proof, and validation state |
| Heatmap | intensity is weighted by risk score; critical zones are outlined in red |

The screenshots and video are historical prototype captures using synthetic data, not real operational records. They predate the local reliability fixes; the current UI withdraws unsupported metrics and distinguishes API-connected synthetic records from operational data.

### Prototype Interface

The ATLAS investigation console brings prediction, geospatial intelligence, alert triage, and account-network analysis into one workflow.

| Investigation dashboard | Predicted cash-out locations |
| --- | --- |
| ![ATLAS investigation dashboard](assets/atlas-homepage.png) | ![ATLAS predicted cash-out locations map](assets/atlas-riskmap.png) |

| Investigation alerts and review queue | System health and database status |
| --- | --- |
| ![ATLAS investigation alerts and review queue](assets/atlas-alerts.png) | ![ATLAS system health and database status](assets/atlas-health.png) |

| Linked account analysis detail |
| --- |
| ![ATLAS linked account analysis](assets/atlas-linked-account-analysis-detail.png) |

### Demo Video

Explore the ATLAS investigation workflow, from risk intelligence and map-based predictions to alert triage and linked-account analysis.

<p align="center">
  <a href="https://youtu.be/yuoHutx33vc">
    <img src="https://img.youtube.com/vi/yuoHutx33vc/maxresdefault.jpg" alt="Watch the ATLAS demonstration video" width="860">
  </a>
</p>

<p align="center">
  <a href="https://youtu.be/yuoHutx33vc"><strong>▶ Watch the ATLAS Demo Video</strong></a>
  &nbsp;·&nbsp;
  <a href="https://youtu.be/yuoHutx33vc">YouTube</a>
</p>

### What This Is

ATLAS is an ML-assisted cybercrime investigation prototype. It ranks synthetic ATM candidates, displays illustrative time windows, and supports alert triage, human review, and tamper-evident evidence handling. Its binary cash-out classifier is not a validated next-ATM or future-time predictor.

### Honest Scope

**What is implemented in this prototype:**

- Shared validated signing-key configuration, JWT rotation, bcrypt, role/action and department checks, CSRF, runtime AES-256-GCM field encryption, and safe static-file containment
- Local cryptographic evidence ledger with tamper-evident verification (not an independent government blockchain)
- Full-stack application with backend, frontend, migration, and browser regression tests; see validation below
- Complete baseline migrations and PostgreSQL/PostGIS integration path with an explicit SQLite demo/test mode
- Eight synthetic cities and 64 ATM fixtures, backend-independent `/demo` navigation, and an authenticated API-backed `/real` console
- Exact ATM prediction snapshots, model identity checks, and clear errors instead of neutral scores when models are unavailable

### Model status (synthetic)

Retrained 2026-10-10 (`rf-xgb-synthetic-v6-20261010`) on group-holdout
synthetic data (n=200000; acc 97.0, P87.3/R33.7/F1 48.7, ROC 0.6668,
PR-AUC 0.36). See `backend/model/validation_report.json`,
`backend/model/metadata.json`, and the UI Model Card page.

Reported holdout figures are **simulator classification metrics only**
(not real-world cash-out location accuracy). Synthetic ATM retrieval over
14 holdout city-slices: Hit@1 6/14, Hit@3 11/14, Hit@5 11/14
(`synthetic_hit_at_k` in `validation_report.json` — small-n, synthetic only).
Future-window coverage remains unavailable without observed outcomes
and authorised data.

The model is decision support — every high-risk case needs human review.

**What remains unvalidated or prototype-only:**

- Future-window coverage and geographic error (need observed future outcomes and authorised data)
- NLP complaint triage (statistical TF-IDF + Naive Bayes classifier trained on illustrative templates, not transformer-based)
- Mule network graph built live from case transaction records with Louvain communities (illustrative records; account-count synthesis only as fallback when no records exist)

**The honest pitch for judges:** "This is a security-focused investigation-console prototype. Its prediction workflow uses persisted, reproducible synthetic transaction fixtures. It has not been validated on real data, connected to a government system, or deployed to production."

**Scope of "100%":** with fully synthetic but end-to-end data, ATLAS implements 100% of the deliverable modules (ranking engine, heatmap, LEA console with alerts + evidence, notifications). It does not claim 100% operational national impact, which requires authorised real data and official channels — honest alignment is ~85–90% of the problem statement.

---

## Why blockchain?

The evidence ledger is not used to make a prediction. It provides a tamper-evident handoff after a prediction or review action: the payload is hashed, linked to the previous block, and mined with the prototype proof-of-work flow. Investigators can inspect the chain and validate linkage from **Evidence → Blockchain Evidence Ledger**. This makes the audit claim visible without implying that a prototype in-process ledger is a production government blockchain.

## Model comparison and explainability

The evaluation pipeline establishes group-disjoint city/time exclusions **before fitting**, records row/group IDs and dataset/artifact hashes, and refuses to score train-inclusive slices as holdouts. The current artifacts (`rf-xgb-synthetic-v6-20261010`, retrained 2026-10-10) carry this provenance in `backend/model/metadata.json` and `backend/model/validation_report.json`; older legacy performance, baseline-superiority, and Top-K claims stay withdrawn — not replaced with invented values.

`/api/model/shap/{case_id}?atm_id=<id>` explains the exact saved candidate inputs and verifies model identity. Ensemble Kernel SHAP uses empirical training rows and an actual expected value; without a valid background, the panel shows global feature importance explicitly **not** local attribution. All explanations are decision support, not causal evidence.

## Security Architecture

| Layer | Implementation |
| ------- | --------------- |
| **Encryption at Rest** | AES-256-GCM bind/result encryption for sensitive ORM fields and sealed evidence previews; legacy plaintext reads supported, no automatic backfill |
| **Authentication** | JWT HS256 — access tokens (1h) + refresh tokens (7d) with rotation & revocation |
| **Password Hashing** | bcrypt; PBKDF2 is used for encryption-key derivation, not password storage |
| **CSRF Protection** | Token-based on all state-changing endpoints |
| **Rate Limiting** | Selected SlowAPI route limits, per-IP auth limits, WebSocket concurrency caps; demo mode relaxes controls |
| **Network Security** | CSP/security headers and explicit CORS; TLS requires configured certificate/key or an authorised reverse proxy |
| **Request Logging** | Method, path, status code, response time with color-coded severity |

---

## Tech Stack

### Frontend

React 18 · TypeScript 5.6 (strict) · Vite 8 · Tailwind CSS 4 · daisyUI 5 · Recharts · Leaflet · d3-force · React Router 7

### Backend setup

Python 3.13 · FastAPI 0.115 · SQLAlchemy 2.0 · PostgreSQL 16 + optional PostGIS / SQLite test fallback · PyJWT · bcrypt

### AI/ML

scikit-learn 1.6.1 (RandomForest) · XGBoost 3.4.1 · SHAP 0.48 · NetworkX 3.3 (Louvain) · pandas 2.2.3 · NumPy 2.5.2. Anomaly/drift surfaces use explicitly labelled heuristics, not validated IsolationForest/PSI monitoring.

---

## Getting Started

### Prerequisites

- Standard CPython 3.13 x64 (fresh-environment validation used 3.13.15)
- Node.js 22.12+ (CI uses Node 22)
- (Optional) PostgreSQL 16 with PostGIS for integration testing; SQLite is used explicitly for local demo/test runs

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env    # configure secrets
# Local API demonstration (Git Bash/POSIX): dedicated database, synthetic records
DEMO_MODE=true DATABASE_URL=sqlite:///./atlas-demo.db python start.py

# Apply the full migration chain and optional demo seed without starting a server
DEMO_MODE=true DATABASE_URL=sqlite:///./atlas-clean-demo.db python start.py --setup-only

# Non-demo: configure DATABASE_URL and three distinct secure secrets first
# Applies migrations, does not seed demo users, and honors paired TLS settings
python start.py
```

### Frontend setup

```bash
cd frontend
npm ci
npm run dev
```

Open **<http://localhost:5173/demo>** for the backend-independent synthetic console (no login required). Backend-only tools are disabled there; acknowledgement/resolution are local session changes. Map tiles/fonts may still require internet.

Use **<http://localhost:5173/login>** for the authenticated API-backed `/real` console. Demo quick-login buttons are enabled only with `VITE_DEMO_MODE=1` and a backend in `DEMO_MODE=true`. `/real` does not imply real-world data.

### Seed Database (Optional)

```bash
cd backend
python seed.py
```

---

## Demo Credentials

| Role | Email | Password |
| ------ | ------- | ---------- |
| Admin | <admin@atlas.gov> | admin123 |
| Inspector | <inspector@atlas.gov> | inspector123 |
| Analyst | <analyst@atlas.gov> | analyst123 |
| Bank Officer | <bank@atlas.gov> | bank123 |

> These public credentials are seeded only in backend demo mode. Stored passwords use bcrypt in both modes. Never expose a demo backend to real investigation data.

### Operational safety

- `/demo` uses bundled city fixtures without API/WebSocket calls; backend-only workflows are visibly disabled.
- Use `/real` only after backend/database checks succeed. Initial loading and failures never display bundled demo predictions.
- Case selection fetches case predictions; changing city restores city overview. All API data in this repository remains synthetic.
- Every candidate prediction saves its exact input vector, model output, version, and fingerprint. Missing models return a controlled 503.
- Field outcomes are recorded for human-reviewed evaluation; predictions are not automated enforcement decisions.
- An authorised future deployment would require PostgreSQL and `alembic upgrade head` before startup; this repository does not provide a production deployment.

---

## API Reference

### Authentication

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/api/auth/login` | Login (returns JWT pair) |
| POST | `/api/auth/register` | Register (pending approval) |
| POST | `/api/auth/refresh` | Refresh token (revokes old) |
| GET | `/api/auth/me` | Current user profile |
| POST | `/api/auth/change-password` | Change password |

### Predictions & Analytics

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/api/dashboard` | Dashboard statistics |
| GET | `/api/predictions/{case_id}` | Prediction for case |
| GET | `/api/cities/{city}/predictions` | City-specific predictions |
| GET | `/api/model/card` | Model metadata |
| GET | `/api/model/metrics` | Precision / recall / F1 |
| GET | `/api/model/drift` | Explicitly labelled heuristic/synthetic diagnostics, not validated PSI |
| GET | `/api/model/shap/{case_id}?atm_id=<id>` | Exact selected-candidate explanation with actual base value or labelled global-importance fallback |
| GET | `/api/model/mule-network` | Mule network graph |
| POST | `/api/model/detect-anomaly` | Anomaly detection |

### Case Management

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/api/cases` | List cases (PII decrypted for authorized roles) |
| GET | `/api/alerts` | Active alerts |
| POST | `/api/alerts` | Create alert |
| GET | `/api/review/queue` | Pending review items |
| POST | `/api/review/{case_id}` | Approve / override / dismiss |

### Evidence, Blockchain & Audit

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/api/evidence/anchor` | Anchor evidence to hash chain + auto-mine PoW block |
| GET | `/api/evidence/chain` | Full evidence chain |
| GET | `/api/evidence/proof/{block_id}` | Merkle proof |
| GET | `/api/evidence/verify/{block_id}` | Verify evidence integrity |
| GET | `/api/evidence/export-pdf/{case_id}` | Case Diary PDF, integrity statement (Sec. 63 BSA format) |
| GET | `/api/blockchain/status` | Primary node + network status |
| GET | `/api/blockchain/chain` | Blockchain blocks + validation |
| GET | `/api/blockchain/validate` | Full chain PoW/linkage validation |
| POST | `/api/blockchain/mine` | Mine pending transactions |
| POST | `/api/blockchain/consensus` | Longest-chain multi-node consensus |
| GET | `/api/audit` | Audit trail |

### NLP & Spatial

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/api/nlp/triage` | Complaint text classification |
| GET | `/api/cities` | List supported cities |
| POST | `/api/model/spatial/nearby` | Nearby ATM lookup |

### Real-Time

| Protocol | Endpoint | Description |
|----------|----------|-------------|
| WS | `/ws/alerts?ticket=<ticket>` | Live alert stream (ticket auth) |

---

## Project Structure

```text
sih-prototype/
├── backend/
│   ├── main.py              # FastAPI app — 56+ documented endpoints
│   ├── auth.py              # JWT, RBAC, CSRF, rate limiting
│   ├── encryption.py        # AES-256-GCM encryption
│   ├── ml_engine.py         # RF+XGBoost ensemble, SHAP, drift
│   ├── evidence_chain.py    # SHA-256 hash chain + Merkle tree
│   ├── blockchain.py        # PoW blockchain: mining, multi-node consensus
│   ├── spatial.py           # PostGIS / haversine fallback
│   ├── models_db.py         # SQLAlchemy models, including synthetic transaction_records
│   ├── alembic/              # Frozen baseline + migrations (0000–0003)
│   ├── seed.py              # Database seeder
│   ├── city_data.py         # 8 cities, 64 ATMs
│   └── tests/               # pytest suite (run the command below for the current count)
├── frontend/
│   ├── src/
│   │   ├── pages/           # 8 route pages
│   │   ├── components/      # 26+ components (incl. BlockchainPanel)
│   │   ├── hooks/           # Data fetching, WebSocket
│   │   └── lib/             # Auth, utilities
│   └── e2e/                 # Playwright end-to-end tests
├── backend/model/           # Synthetic model artifacts, metadata, and validation status
└── .env.example
```

---

## Testing

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend unit tests
cd frontend && npm test -- --run

# Frontend (TypeScript strict)
cd frontend && npx tsc --noEmit

# Backend-independent browser regression
cd frontend && npx playwright test e2e/local-safety.spec.ts

# Isolated real-handler integration (Git Bash; uses installed Python dependencies)
# Run from frontend; the Python bridge owns a temporary DB and never sends notifications
ATLAS_REAL_BACKEND_E2E=1 ATLAS_TEST_PYTHON=../.venv/Scripts/python.exe npx playwright test e2e/real-backend.spec.ts

# Remaining legacy browser tests require a separately running synthetic backend
npx playwright test
```

---

## Environment Variables

Configure `backend/.env` (git-ignored). Outside explicit demo/test mode, access and refresh signing keys must each have at least 32 characters and must differ; the encryption key must be a non-default 64-character hex key. `JWT_SECRET_KEY` is an alias for `SECRET_KEY`; if both are set they must agree. Do not rotate the encryption key without a planned data migration.

```env
DATABASE_URL=postgresql://postgres:password@host:5432/atlas
SECRET_KEY=<256-bit hex>
REFRESH_SECRET_KEY=<256-bit hex>
ENCRYPTION_KEY=<256-bit hex>
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Optional — TLS
SSL_CERTFILE=
SSL_KEYFILE=

# Optional — SMS (TextBee device gateway; prototype demo channel, not a government SMS system)
SMS_PROVIDER=textbee
TEXTBEE_API_KEY=
TEXTBEE_DEVICE_ID=
INVESTIGATOR_PHONE_NUMBER=+91XXXXXXXXXX

# Optional — Email (SMTP; prototype notification path)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
INVESTIGATOR_EMAIL=
```

HIGH-risk predictions (risk_score > 70) raise a dashboard alert, a WebSocket toast, and — once per open case+ATM — a TextBee SMS plus an SMTP email built from the prediction fields. Repeat predictions dispatch nothing new until acknowledged/resolved, and per-kind cooldown (45 min) plus daily caps (10 SMS / 20 email, env-configurable) fail soft to dashboard-only. An officer can also trigger one manual dispatch per open alert via the **Notify officer** button (`POST /api/alerts/{id}/notify`, same guards). Kill-switches `ALERTS_SMS_ENABLED` / `ALERTS_EMAIL_ENABLED` reduce the console to dashboard toasts. TextBee is a prototype device gateway and SMTP email a prototype path; production would use authorised LEA/bank/I4C channels, and India production SMS would require DLT plus an approved gateway where applicable. Synthetic data only; decision support, not automated enforcement.

---

## Model Limitations (read before citing accuracy)

Retrained 2026-10-10 (`rf-xgb-synthetic-v6-20261010`, 200k grouped-synthetic rows): group holdout precision 87.3 / recall 33.7 / F1 48.7 / ROC-AUC 0.67 / PR-AUC 0.36; time and location holdouts score similarly (see `model/validation_report.json`). Synthetic ATM retrieval over 14 holdout city-slices (rank slice ATMs by mean model score; truth = slice ATM with most actual cash-outs): Hit@1 6/14, Hit@3 11/14, Hit@5 11/14 — small-n and synthetic only, not real-world next-ATM accuracy. High precision at the cost of recall is deliberate (avoid alert fatigue on a minority class). The model is **decision support, not an enforcement decision** — every flagged case requires human review, and none of this validates against real data.

The revised generator keeps fraud-ring geography consistent, saves group IDs, and uses the same observable evening-window feature as serving. Its target is a synthetic cash-out event, **not automatically fraudulent cash-out**. Group-disjoint evaluation still measures simulator classification, not real-world location/time effectiveness.

To explicitly regenerate and retrain (these commands replace generated datasets/model artifacts; back up anything you want to retain):

```bash
cd backend
python generate_data.py
python train_model.py
python revalidate_model.py
```

Training saves empirical SHAP background and pre-fit split/artifact provenance. Revalidation refuses mismatched artifacts or datasets. Regeneration commands were run 2026-10-10 (data, weights, metadata, validation report all committed); library versions are recorded in metadata.

Actual next-ATM Hit@K, geographic error, and future-window coverage need case-grouped candidates, prediction-time cutoffs, and observed future outcomes. Authorised data, investigator feedback, and separate validation would be required before operational use.

---

## Local validation and remaining limits

- Full isolated backend suite: **268 passed, 2 skipped** in the existing environment (fresh Windows CPython 3.13 installs from `backend/requirements.txt` pass the same suite).
- Fresh dependency installation, `pip check`, SHAP import, and bundled estimator loading passed. Windows/Linux wheel resolution passed; Linux runtime was not exercised locally.
- Frontend: **86 unit tests passed**, lint and production build passed; **32 browser tests passed, 1 skipped** (Postgres integration skip), including an isolated real-FastAPI-handler investigation flow.
- Real-handler browser integration uses TestClient transport and a temporary database; it is not a deployed HTTP/WebSocket/TLS test. No SMS/email delivery occurred.
- Skips: Windows symlink privilege and unconfigured PostgreSQL/PostGIS integration. Existing XGBoost pickle-format warnings remain.
- No legacy-data encryption backfill, further retraining beyond the committed 2026-10-10 artifacts, production deployment, real-data validation, or distributed-concurrency guarantee is claimed. Blockchain nodes are local simulations.
- Package transitive dependencies are not fully locked. Re-run the documented checks in your submission environment.

## Data Disclaimer

This prototype uses **only reproducible synthetic demonstration data**. No real or unauthorised banking, financial, crime, or government data is used. Runtime prediction records are stored in `transaction_records` and queried by the prediction engine; they are synthetic fixtures, not operational records. The model and operational simulation have not been validated on real data. The `/real` route means the non-fallback application route, not a claim that its data is real.

---

## License

Security-focused prototype for Smart India Hackathon 2026. Built to demonstrate security controls and evidence-chain integrity; it is not a production deployment.
