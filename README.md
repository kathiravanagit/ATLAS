# ATLAS — Advanced Threat Location & Alert System

[![CI](https://github.com/kathiravanagit/ATLAS/actions/workflows/ci.yml/badge.svg)](https://github.com/kathiravanagit/ATLAS/actions/workflows/ci.yml)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-2563eb)](./frontend)
[![Backend](https://img.shields.io/badge/backend-FastAPI-059669)](./backend)

## Smart India Hackathon 2026 — Problem Statement 26184

<p align="center">
  <img src="assets/atlas-architecture.svg" alt="ATLAS system architecture: data to ML, geospatial ranking, SHAP, alerts, blockchain evidence, and dashboard" width="100%">
</p>

### Product tour

The console is organised around the complete investigation loop:

| Surface | What to look for |
| --- | --- |
| Dashboard | model status, lead time, ranked locations, and the notification count |
| Ranked ATM map | city switching, time/risk filters, red high-risk zones, and the weighted heatmap |
| SHAP panel | per-case feature contributions and the plain-language investigative briefing |
| Alert flow | high-risk predictions become reviewable alerts; acknowledgement is recorded |
| Blockchain evidence | hash-chain integrity, PoW status, Merkle proof, and validation state |
| Heatmap | intensity is weighted by risk score; critical zones are outlined in red |

The interface screenshots below were captured from the synthetic `/demo` console. They use demonstration data only and do not represent real operational data.

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

[Watch the ATLAS demonstration video](<assets/Demo Video - Advanced Threat Location & Alert System.mp4>)

### What This Is

ATLAS is a cybercrime cash-out prediction platform. It takes complaint data, runs it through an ML pipeline, and predicts **where** the next ATM cash-out is likely to happen — giving law enforcement a lead time window to deploy.

### Honest Scope

**What is implemented in this prototype:**

- Security architecture (AES-256-GCM, JWT rotation, RBAC, CSRF, rate limiting, TLS)
- Cryptographic evidence chain-of-custody with tamper-evident verification
- Full-stack application with 56+ documented API endpoints, 135 passing backend tests, and 34 passing frontend unit tests
- PostgreSQL/PostGIS integration path with an explicit SQLite test fallback
- Multi-city support — 8 synthetic demonstration cities and 64 synthetic ATM records with city switching on the map

**What remains unvalidated or prototype-only:**

- The ML prediction model and operational simulation (trained and evaluated only on synthetic data — see accuracy note)
- NLP complaint triage (keyword-based, not transformer-based)
- Mule network graph analysis (demonstrates the concept, needs real transaction graphs)

**The honest pitch for judges:** "This is a security-focused investigation-console prototype. Its prediction workflow uses persisted, reproducible synthetic transaction fixtures. It has not been validated on real data, connected to a government system, or deployed to production."

---

## Why blockchain?

The evidence ledger is not used to make a prediction. It provides a tamper-evident handoff after a prediction or review action: the payload is hashed, linked to the previous block, and mined with the prototype proof-of-work flow. Investigators can inspect the chain and validate linkage from **Evidence → Blockchain Evidence Ledger**. This makes the audit claim visible without implying that a prototype in-process ledger is a production government blockchain.

## Model comparison and explainability

ATLAS reports the metrics that matter for the imbalanced synthetic benchmark: precision, recall, F1, PR-AUC, and the majority-class accuracy baseline. The majority baseline is deliberately shown because the 97.7% accuracy figure is otherwise misleading. The production UI also exposes the model's feature contributions in the SHAP panel; these are decision-support explanations, not causal claims. A historical-density-only benchmark is not yet validated in this repository and should be added before claiming uplift over that specific baseline.

## Security Architecture

| Layer | Implementation |
| ------- | --------------- |
| **Encryption at Rest** | AES-256-GCM for sensitive fields (victim PII, alert messages) |
| **Authentication** | JWT HS256 — access tokens (1h) + refresh tokens (7d) with rotation & revocation |
| **Password Hashing** | PBKDF2-HMAC-SHA256 — 600,000 iterations (OWASP 2023) |
| **CSRF Protection** | Token-based on all state-changing endpoints |
| **Rate Limiting** | 3-layer: slowapi global, per-IP auth limits, WebSocket concurrency caps |
| **Network Security** | TLS/HTTPS, HSTS, CSP, CORS (explicit origins), 7 security headers |
| **Request Logging** | Method, path, status code, response time with color-coded severity |

---

## Tech Stack

### Frontend

React 18 · TypeScript 5.6 (strict) · Vite 5.4 · Tailwind CSS · daisyUI · Recharts · Leaflet · d3-force · React Router 6

### Backend setup

Python 3.13 · FastAPI 0.115 · SQLAlchemy 2.0 · PostgreSQL 16 + optional PostGIS / SQLite test fallback · python-jose · passlib

### AI/ML

scikit-learn 1.5 (RandomForest) · XGBoost 2.1 · SHAP 0.46 · NetworkX 3.3 (Louvain) · IsolationForest · Pandas · NumPy

---

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 20+
- (Optional) PostgreSQL 16 with PostGIS for integration testing; SQLite is used explicitly for local demo/test runs

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env    # configure secrets
# Default: connects to the configured PostgreSQL/Supabase database and applies migrations
python start.py

# Explicit local demo only: uses SQLite and synthetic data
DEMO_MODE=true python start.py

# Production/staging (same default behavior): apply migrations before starting the API
alembic upgrade head
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open **<http://localhost:5173>**

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

> Demo credentials are plaintext for hackathon evaluation only. Production uses hashed passwords.

### Operational safety

- Use `/demo` only for synthetic demonstration data.
- Use `/real` only after the backend and database health checks are green.
- The live console does not replace failed API responses with synthetic data.
- Every prediction records the model version used to generate it.
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
| GET | `/api/model/drift` | PSI drift analysis |
| GET | `/api/model/shap/{case_id}` | SHAP explanations |
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
| WS | `/ws?ticket=<ticket>` | Live alert stream (ticket auth) |

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
│   ├── alembic/              # Schema migrations (0001–0003)
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
├── model/                   # Synthetic model artifacts and metadata
├── docker-compose.yml
└── .env.example
```

---

## Testing

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend unit tests (currently 34)
cd frontend && npm test -- --run

# Frontend (TypeScript strict)
cd frontend && npx tsc --noEmit

# E2E
cd frontend && npx playwright test
```

---

## Environment Variables

Configure `backend/.env` (git-ignored):

```env
DATABASE_URL=postgresql://postgres:password@host:5432/atlas
SECRET_KEY=<256-bit hex>
REFRESH_SECRET_KEY=<256-bit hex>
ENCRYPTION_KEY=<256-bit hex>
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Optional — TLS
SSL_CERTFILE=
SSL_KEYFILE=

# Optional — SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Optional — Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
```

---

## Model Limitations (read before citing accuracy)

From `backend/model/metadata.json` (40,000-sample eval set, 1,458 cash-out vs 38,542 negatives):

| Metric | Value | Meaning |
|---|---|---|
| Accuracy | 97.7% | Inflated by the 96.4% majority class — **not** the headline metric |
| Precision (cash-out) | 95.8% | When the model flags fraud, it's right ~96% of the time |
| **Recall (cash-out)** | **39.4%** | Catches ~4 in 10 actual cash-out events |
| F1 (cash-out) | 55.8% | The balanced metric that matters here |
| PR-AUC | 0.446 | Ranking quality on imbalanced data |
| Confusion | TP 574 · FP 25 · FN 884 · TN 38,517 | Misses (FN 884) dominate errors |

Deliberate tradeoff: the threshold is tuned for **high precision to reduce simulated alert volume** on the synthetic benchmark. The model is **decision support, not an enforcement decision** — every flagged case requires human review. No real-data validation is claimed; any future retraining would require authorised data and an approved validation process.

---

## Data Disclaimer

This prototype uses **only reproducible synthetic demonstration data**. No real or unauthorised banking, financial, crime, or government data is used. Runtime prediction records are stored in `transaction_records` and queried by the prediction engine; they are synthetic fixtures, not operational records. The model and operational simulation have not been validated on real data. The `/real` route means the non-fallback application route, not a claim that its data is real.

---

## License

Security-focused prototype for Smart India Hackathon 2026. Built to demonstrate security controls and evidence-chain integrity; it is not a production deployment.
