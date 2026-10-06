# ATLAS — Advanced Threat Location & Alert System

## Smart India Hackathon 2026 | Problem Statement PS-26184

---

## Executive Summary

**ATLAS** is an AI-powered cybercrime cash-out prediction prototype for investigation-workflow demonstration. Using synthetic records, it estimates *where* and *when* a simulated cash-out may occur; it does not make real-world predictions or enforcement decisions.

The workflow models a hypothetical complaint-to-cash-out sequence. ATLAS demonstrates how ranked locations, time windows, and risk scores could be presented for human review; it is not connected to cybercrime.gov.in, banking systems, or government systems.

### What We Built

- **End-to-end ML pipeline** — Complaint → Feature engineering → Ensemble scoring → Ranked predictions
- **Security-focused prototype controls** — AES-256-GCM, JWT rotation, RBAC, CSRF, rate limiting, TLS support
- **Cryptographic evidence chain** — SHA-256 hash chain with Merkle tree verification
- **PoW blockchain** — SHA-256 mining, Merkle roots, 3-node longest-chain consensus
- **Full-stack application** — React + TypeScript frontend, FastAPI + PostgreSQL backend
- **56+ API endpoints** with 135 passing backend tests and 34 passing frontend unit tests (Playwright is a separate E2E suite)
- **Multi-city support** — 8 synthetic demonstration cities with 64 synthetic ATM records and city switching on the interactive map

---

## The Problem

### Current State of Cybercrime Investigation

India reported **11.28 lakh cybercrime cases** in 2024 with losses exceeding ₹10,319 crore (NCRB Data). The investigation workflow today:

```text
Complaint Filed ──────► Money Split Across Mules ──────► Cash Withdrawn
        │                         │                              │
    T+0 hours               T+15-30 min                    T+1-2 hours
        │                         │                              │
    Police Start            Too Late                   Money Gone
    Investigation
```

Law enforcement needs **predictive intelligence** — not just forensic tracing after the fact, but actionable predictions about where the next cash-out will happen.

### Why Existing Solutions Fall Short

| Existing Tool | Limitation |
| -------------- | ----------- |
| Cybercrime.gov.in | Complaint filing only, no prediction |
| Bank fraud detection | Alerts after transaction, not before |
| CCTV surveillance | Requires manual monitoring, no intelligence |
| Manual investigation | Slow, reactive, resource-intensive |

**None of these predict WHERE the cash-out will happen.**

---

## Our Solution

### How It Works

#### Phase 1: Complaint Ingestion

When a victim reports cybercrime, the system captures transaction amount, type (UPI/NEFT/RTGS/card fraud), victim's last known location, suspect account details, and time of incident.

#### Phase 2: Transaction Simulation

The backend simulates criminal operation patterns — money split across 3-5 mule accounts, each making withdrawal attempts at different ATMs. **Synthetic transaction fixtures are persisted in `transaction_records` and queried by the prediction engine. They are reproducible synthetic records only, never real or unauthorised data.**

#### Phase 3: ML Prediction Engine

An ensemble of **Random Forest + XGBoost** classifiers analyzes **15 risk features** for every ATM in the region:

| Feature | Description | Weight |
| --------- | ------------- | -------- |
| distance_from_victim_km | Haversine distance to victim's last ATM | High |
| historical_crime_density | Historical crime density at ATM location | High |
| time_window_match | Time window fit score | High |
| atm_type_score | ATM risk profile (high_value, commercial, retail, etc.) | High |
| suspect_distance_km | Distance to nearest suspect | High |
| recent_withdrawal_freq | Recent withdrawal frequency | Medium |
| amount | Transaction amount in INR | High |
| num_mule_accounts | Number of mule accounts involved | Medium |
| hour | Hour of day | High |
| day_of_week | Day of week | Medium |
| transaction_velocity | Transaction velocity | Medium |
| proximity_score | Proximity score | Medium |
| density_score | Area density score | Medium |
| suspect_proximity | Suspect proximity flag | Medium |
| amount_factor | Amount factor | Low |

#### Phase 4: Risk Scoring

Each ATM receives a risk score (capped at 99%):

- **>70%: HIGH RISK** → Auto-generate alert, notify investigators
- **45-70%: MEDIUM RISK** → Queue for review
- **<45%: LOW RISK** → Log for pattern analysis

#### Phase 5: Alert & Investigation

Investigators receive ranked locations, time windows, SHAP-based explainability, interactive map views, and full audit trail.

---

## Technical Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Landing  │  │  Login   │  │ Dashboard│  │ Console  │       │
│  │   Page    │  │ Register │  │  (Stats) │  │ (Full)   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│       │              │             │              │              │
│       └──────────────┴─────────────┴──────────────┘              │
│                              │                                    │
│                    React Router + Vite                            │
│                    TypeScript + Tailwind                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API + WebSocket
┌──────────────────────────────┴──────────────────────────────────┐
│                         BACKEND                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Server                         │   │
│  │                                                           │   │
│  │  Auth (JWT + RBAC)  │  CSRF Protection  │  Rate Limiting │   │
│  │                                                           │   │
│  │  /api/transactions ──► ML Predictor ──► Spatial Queries   │   │
│  │         │                   │                │            │   │
│  │         ▼                   ▼                ▼            │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │       Database Layer                             │    │   │
│  │   │   SQLAlchemy + PostgreSQL / SQLite test database │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│                    PostgreSQL / SQLite test database              │
│                                                                  │
│  cases | predictions | ranked_locations | alerts | atm_locations │
│  transaction_records | evidence_blocks | blockchain_blocks       │
│  suspects | audit_logs | field_outcomes | users                  │
└─────────────────────────────────────────────────────────────────┘
```text

### Technology Stack

| Component | Technology | Rationale |
| ----------- | ----------- | ----------- |
| **Frontend** | React 18 + TypeScript 5.6 | Type safety, component reusability |
| **Build Tool** | Vite 8 | Fast HMR, optimized builds |
| **Styling** | Tailwind CSS 4 + daisyUI 5 | Responsive console styling |
| **Maps** | React-Leaflet + Esri Satellite | Real satellite imagery |
| **Graph** | d3-force + react-force-graph-2d | Mule network visualization |
| **Backend** | FastAPI 0.115 (Python 3.13) | Async, auto-documentation |
| **ORM** | SQLAlchemy 2.0 | Python ecosystem standard |
| **Database** | PostgreSQL 16 + SQLite test fallback | PostgreSQL is the intended integration database; no hosted deployment is included |
| **Spatial** | Optional PostGIS auto-detection + haversine fallback | PostGIS integration is verified only when configured |
| **ML** | scikit-learn 1.5 + XGBoost 2.1 | Ensemble accuracy |
| **Explainability** | SHAP 0.46 (KernelExplainer) | Per-case feature contributions |
| **Auth** | PyJWT (JWT HS256) + bcrypt direct | Production security |
| **Encryption** | cryptography (AES-256-GCM) | Authenticated encryption |
| **Blockchain** | SHA-256 PoW (stdlib) | Evidence ledger, multi-node consensus |

---

## Security Architecture

These controls are implemented for prototype evaluation. They are not a production certification or evidence that the system is ready for deployment.

### Encryption at Rest

- **AES-256-GCM** — Authenticated encryption for sensitive fields (victim names, contacts, descriptions)
- **PBKDF2-HMAC-SHA256** — 600,000 iteration key derivation (OWASP 2023)
- **Transparent layer** — API encrypts on write, decrypts on read
- **Key management**: For prototype, AES key in environment variable. Production: AWS KMS or HashiCorp Vault.

### Authentication & Authorization

- **JWT HS256** — Access tokens (1h) + refresh tokens (7d) with rotation
- **Refresh revocation** — Old tokens revoked on rotation
- **4 roles with granular permissions:**
  - `admin`: read, write, delete, override, manage_users
  - `inspector`: read, write, override
  - `analyst`: read, write
  - `bank_officer`: read, write (review queue access — bank officers flag false positives and override risk scores for their institution's cases)
- **bcrypt** — direct `bcrypt.checkpw`/`hashpw` wrapper (no passlib); verifies legacy `$2b$` hashes

### Network Security

- **TLS/HTTPS** — Supported via uvicorn SSL context (requires SSL_CERTFILE and SSL_KEYFILE env vars; app starts without TLS if unset)
- **HSTS** — `max-age=31536000; includeSubDomains`
- **CORS** — Explicit allowed origins (not wildcard)
- **8 security headers** — CSP (script-src without `unsafe-inline`/`unsafe-eval`, plus `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`), X-Frame-Options, X-Content-Type-Options, etc.
- **Password policy** — 8+ chars with a letter and a digit (register + change-password)
- **Registration gate** — self-registration returns 403 with an actionable message when disabled (DEMO_MODE precedence over REGISTRATION_ENABLED)
- **Demo credentials API** — `GET /api/auth/demo-credentials` serves demo logins to the UI only in DEMO_MODE (404 otherwise); demo passwords are never shipped in the JS bundle
- **HttpOnly refresh cookie** — `atlas_refresh` (path `/api/auth`, SameSite=Strict) issued on login/refresh/logout with body-token fallback; login rate limiting with reset on success
- **Data retention** — `GET /api/admin/retention` (policy) + `POST /api/admin/retention/purge` (admin+CSRF) purges only audit/notification/idempotency rows; cases/evidence/alerts are never purged

### Rate Limiting

1. **slowapi** — Global API rate limiter
2. **Custom RateLimiter** — Per-IP auth tracking (disabled in DEMO_MODE)
3. **WebSocket IP Tracker** — Max 5 concurrent connections per IP

### Request Logging

- Middleware logs every request: `METHOD /path → STATUS (Xms)`
- Color-coded: green (<200ms), yellow (200-500ms), red (>500ms)
- Uvicorn access log enabled for full HTTP tracing

### CSRF Protection

- Token-based on all state-changing POST endpoints
- Auto-fetched by frontend for all state-changing requests

---

## Blockchain & Evidence Chain

**Proof-of-Work blockchain + SHA-256 hash chain with Merkle tree — two complementary layers.**

### 1. Hash Chain (Evidence Register)

- **SHA-256 hash chain** — Each evidence record's hash includes the previous, creating an unbreakable chain
- **Merkle tree** — O(log n) tamper verification via Merkle proofs
- **File-backed persistence** — JSON storage for single-node deployment
- **Chain-of-custody** — Who added what, when, with cryptographic proof

### 2. PoW Blockchain (`backend/blockchain.py`)

- **Blocks** — index, transactions, previous_hash, nonce, miner, difficulty, Merkle root
- **Proof-of-Work** — SHA-256 mining with configurable difficulty (leading hex zeros)
- **Auto-mine on anchor** — Every `POST /api/evidence/anchor` queues a tx and mines a block
- **Multi-node network** — 3 simulated cybercell nodes (Mumbai, Delhi, Bangalore)
- **Longest-chain consensus** — `POST /api/blockchain/consensus` syncs all nodes to the valid longest chain
- **Validation** — PoW check, hash linkage, Merkle root integrity per block

### Blockchain API

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/api/blockchain/status` | Primary node + network status |
| GET | `/api/blockchain/chain` | Blocks (limit) + validation result |
| GET | `/api/blockchain/validate` | Full chain PoW/linkage/Merkle validation |
| POST | `/api/blockchain/mine` | Mine pending transactions (write) |
| POST | `/api/blockchain/consensus` | Longest-chain consensus across nodes (write) |

### Demo flow (Evidence page → Blockchain panel)

1. Anchor evidence → block auto-mined (tx + PoW nonce visible)
2. Expand block → nonce, difficulty, Merkle root, tx details
3. Run consensus → 3 nodes agree on longest valid chain
4. Validate → chain integrity confirmed

---

## ML Pipeline

### Training Data

Trained on **200,000+ synthetic transactions** across **400 synthetic ATM records in 8 demonstration cities** with a synthetic class balance. The 200k transactions are used to train the ML model offline. The runtime database stores 64 synthetic ATM records (8 per city) as a demonstration subset. These figures are not real-data validation.

### Model Architecture

- **Ensemble**: RandomForestClassifier (200 trees) + XGBoostClassifier (200 estimators)
- **Weighted averaging**: RF + XGBoost ensemble
- **Features**: 15 engineered features (distance, historical_crime_density, time_window, suspect_distance, amount, num_mules, hour, day_of_week, etc.)

### Performance (Fraud Class — Imbalanced Data)

| Metric | Value | What it means |
| -------- | ------- | --------------- |
| **Recall** | 39.4% | Fraud cases correctly detected |
| **F1 Score** | 55.8% | Precision-recall balance |
| **Precision** | 95.8% | Alerts that are real fraud |
| **PR-AUC** | 0.446 | Precision-recall curve quality |
| **ROC AUC** | 0.720 | Ranking quality |
| **Accuracy** | 97.7% | Inflated by 96.35% majority class |
| Training samples | 200,000 | Synthetic, 8 cities |
| ATMs (training) | 400 | 50 per city |
| ATMs (live) | 64 | 8 per city |

> **Note:** Accuracy is misleading on imbalanced data (1 in 27 transactions is fraud). We lead with Recall and F1 — the metrics that matter for fraud detection.

### Validation & Holdout Revalidation

- **Time holdout** + **location holdout** revalidation runs (`backend/revalidate_model.py`) write `backend/model/validation_report.json`
- **Calibration**: 10-bin reliability curve + Brier score; **threshold sweep** reported alongside the default operating point
- Served on `GET /api/model/card` as `validation_protocol.holdout_revalidation`, rendered in the Model Card page (Data & Model Lineage + Holdout Revalidation cards)
- Protocol is explicit: majority-class baseline accuracy is shown so 96%+ accuracy is never read as model skill

### Explainability

SHAP KernelExplainer generates per-case feature contributions, cached to avoid repeated slow computation during demos.

### Supporting Components

- **Drift Monitoring**: Population Stability Index for model health
- **Anomaly Detection**: Isolation Forest for unusual patterns
- **Mule Network**: NetworkX Louvain community detection
- **NLP Triage**: Keyword-based complaint classification with non-cybercrime fallback
- **Blockchain**: SHA-256 PoW mining, Merkle roots, multi-node longest-chain consensus

---

## Database Schema

### Tables

| Table | Purpose | Key Columns |
| ------- | --------- | ------------- |
| `cases` | Cybercrime complaints | case_id, victim_name, amount, status, crime_type |
| `predictions` | ML model output | prediction_id, case_id, risk_score, primary_atm_id |
| `ranked_locations` | Top-N predictions per case | location_id, prediction_id, atm_id, risk_score, rank |
| `alerts` | System alerts for investigators | alert_id, case_id, risk_score, message, status |
| `atm_locations` | ATM master data | atm_id, location_name, latitude, longitude |
| `suspects` | Suspect profiles | suspect_id, case_id, name, account_number |
| `audit_logs` | Immutable audit trail | log_id, case_id, action, details, timestamp |
| `field_outcomes` | Investigation results | outcome_id, case_id, outcome_type, notes |
| `users` | System users | id, email, role, is_approved |

---

## API Endpoints (56+)

### Authentication (8)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/api/auth/login` | Login (returns JWT tokens) |
| POST | `/api/auth/register` | Register (pending approval) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Current user info |
| PUT | `/api/auth/me` | Update profile |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/csrf-token` | Get CSRF token |
| POST | `/api/auth/approve/{user_id}` | Approve user (admin) |
| GET | `/api/auth/demo-credentials` | Demo logins for quick-login buttons (DEMO_MODE only, 404 otherwise) |

### Core Data (5)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | Dashboard stats + impact metrics |
| GET | `/api/cases` | List cases |
| GET | `/api/predictions` | All predictions |
| GET | `/api/predictions/{case_id}` | Prediction for case |

### Transactions & Alerts (4)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/api/transactions` | Record a synthetic simulation transaction |
| GET | `/api/alerts` | Active alerts |
| POST | `/api/alerts` | Create alert |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge alert |

### Evidence, Blockchain & Review (11)

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
| GET | `/api/review/queue` | Pending review items |
| POST | `/api/review/{case_id}` | Approve/override/dismiss (write permission) |

### ML Model (6)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/api/model/card` | Model metadata |
| GET | `/api/model/metrics` | Precision/recall/F1 |
| GET | `/api/model/drift` | PSI drift analysis |
| GET | `/api/model/shap/{case_id}` | SHAP explanations |
| GET | `/api/model/mule-network` | Graph-based detection |
| POST | `/api/model/detect-anomaly` | Anomaly score |

### Spatial & GIS (3)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/api/model/spatial` | Spatial engine status |
| POST | `/api/model/spatial/enable-postgis` | Enable PostGIS |
| GET | `/api/model/spatial/nearby` | Find nearby ATMs |

### NLP & Cities (4)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/api/nlp/triage` | Complaint text analysis |
| GET | `/api/cities` | All 8 cities |
| GET | `/api/cities/{city}/atms` | ATMs in city |
| GET | `/api/cities/{city}/predictions` | Predictions for city |

### Field Outcomes (2)

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/api/field-outcomes` | Record investigation outcome |
| GET | `/api/field-outcomes` | List outcomes |

### Audit & Admin

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| GET | `/api/audit` | Audit log entries (limit/offset + `q`, `actor`, `action_type` search; returns `date`, `case_id`) |
| GET | `/api/audit/recent` | Recent activity (last 50) |
| GET | `/api/review/history` | Review decision history |
| GET | `/api/auth/users` | List all users (admin/inspector) |
| GET | `/api/auth/tokens` | List refresh tokens (admin) |
| GET | `/api/scenarios` | Available demo scenarios |
| GET | `/api/scenarios/{id}` | Run a demo scenario |
| GET | `/health/live` | Public liveness probe (`{"status": "ok"}` only) |
| GET | `/api/notifications/jobs` | Durable notification dispatch states (queued/sending/sent/failed/dead) |
| GET | `/api/admin/retention` | Documented retention policy (audit/notification/idempotency) (admin) |
| POST | `/api/admin/retention/purge` | Purge rows older than `days`; case/evidence/alerts untouched (admin+CSRF) |

### Reliability, Versioning & Deployment

| Concern | Implementation |
| --------- | ---------------- |
| **Idempotency** | `Idempotency-Key` header on POST `/api/transactions`, `/api/alerts`, `/api/evidence/anchor` — replays return the original response (`X-Idempotent-Replay: true`), no duplicate side effects |
| **Notifications** | `notification_jobs` table + tracked worker with retry (3 attempts) + dead-letter; replaces fire-and-forget threads |
| **API versioning** | `/api/v1/*` serves the current API (prefix-strip middleware) |
| **Migrations** | Alembic (`backend/alembic/`, revisions `0001`–`0003`): hardening tables, model versioning, and synthetic `transaction_records` — run `alembic upgrade head` |
| **Chain storage** | `CHAIN_BACKEND=db` (default on Postgres) persists evidence/blockchain blocks transactionally; `file` for offline demos/tests |
| **Ownership scoping** | `GET /api/cases`: admins see all; other roles see own department + assigned + shared pool |
| **Frontend guard** | `RequireAuth` on `/real`; explicit `/demo` fallback-only console; role matrix in `frontend/src/lib/roles.ts` |

### WebSocket

| Protocol | Endpoint | Description |
|----------|----------|-------------|
| WS | `/ws?token=<jwt>` | Real-time alerts |

---

## Demo Credentials

| Role | Email | Password | Permissions |
| ------ | ------- | ---------- | ------------- |
| Admin | <admin@atlas.gov> | admin123 | Full access |
| Inspector | <inspector@atlas.gov> | inspector123 | Read, write, override |
| Analyst | <analyst@atlas.gov> | analyst123 | Read, write |
| Bank Officer | <bank@atlas.gov> | bank123 | Read, write |

---

## Frontend Components

### Pages

- **Landing Page** — Hero section with animated background, system overview
- **Login / Register** — Government-styled auth with demo login dropdown (4 quick-login buttons)
- **Dashboard** — 6 stat cards (cases, alerts, lead time, prevented fraud, mules flagged), prediction card, risk trend chart
- **Investigation Console** — Full workspace with map, cases, alerts, audit, ML model

### Key Components

- **TopNav** — City selector (8 cities), explicit live/demo/unavailable status, scenario runner, user profile
- **MapView** — Leaflet map with city-based remount, color-coded ATM markers (red >70%, orange 45-70%, blue <45%), risk heatmap circles
- **PredictionCard** — Risk score visualization, primary ATM, time window, evidence signals
- **ExplainabilityPanel** — Auto-generated "Investigative Briefing" + SHAP feature bars
- **RankedLocationsTable** — Sticky headers, risk-colored rows, search/filter
- **MuleNetworkGraph** — d3-force graph with "How to Read" legend
- **NlpComplaintTriage** — Paste complaint, extract entities, handle non-cybercrime input
- **AuditLog** — Government portal-style activity log with type filtering (alert, prediction, case, system, review, search)
- **CasesTable** — Searchable, filterable, status indicators, sticky headers
- **AlertPanel** — Active alerts with acknowledgment, notification history
- **ReviewQueue** — Approve/override/dismiss cases with proper form interaction
- **BlockchainPanel** — PoW ledger: height, difficulty, nonce, mine, 3-node consensus

### Demo Features

- **Scenario Runner** — 3 pre-baked scenarios in TopNav dropdown
- **Demo Login** — Quick-login buttons for all 4 roles
- **Live outage handling** — The live console blocks operational content when the API is unavailable and instructs officers not to act until recovery
- **Explicit Demo Mode** — Synthetic data is available only through `/demo`; it is never substituted into `/real`

### Multi-City Map

- **City Selector** — Dropdown in TopNav with 8 cities and their states
- **Live Switching** — Map re-centers to new city, shows correct ATMs and risk scores
- **MapContainer Key** — Remounts Leaflet on city change for clean state
- **Risk Filters** — All/Critical/Elevated/Normal + time window filters
- **Heatmap Toggle** — Show/hide risk zone circles (200m/150m/100m radius)

---

## How to Run

### Prerequisites

- Python 3.13+
- Node.js 20+

### Backend

```bash
cd backend
pip install -r requirements.txt
# Create .env from .env.example
python -m uvicorn main:app --reload --port 8000
```

### Frontend

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

Seeds 64 ATMs, 23 cases, 20 suspects, 77 audit logs, 7 field outcomes, 17 predictions.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:password@host:5432/atlas

# JWT Secrets (256-bit hex)
SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_hex(32))">
REFRESH_SECRET_KEY=<generate separately>

# AES-256 Encryption Key
ENCRYPTION_KEY=<generate separately>

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# TLS (optional)
SSL_CERTFILE=
SSL_KEYFILE=

# Twilio & Email (optional — app works without it)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
INVESTIGATOR_PHONE_NUMBER=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
ALERT_FROM_EMAIL=alerts@atlas.gov
INVESTIGATOR_EMAIL=investigator@atlas.gov
```

---

## Tests

```bash
# Backend — run the suite after installing `backend/requirements.txt`
cd backend && python -m pytest tests/ -v

# Frontend — TypeScript strict mode
cd frontend && npx tsc --noEmit

# Frontend production bundle
cd frontend && npm run build

# E2E — Playwright (run separately with Chromium)
cd frontend && npx playwright test
```

### What We Test

**Backend:** The suite covers:

- Authentication (login, register, refresh, token reuse)
- RBAC (all 4 roles for read/write/override)
- CSRF protection on state-changing endpoints
- Evidence chain (anchor, verify, list)
- Blockchain (PoW mining, validation, consensus, evidence auto-mine, auth)
- ML endpoints (predictions, model card, metrics, drift, SHAP, mule network, anomaly)
- NLP triage (vishing, UPI fraud, non-cybercrime fallback)
- City endpoints (list, info, ATMs, predictions)
- Security headers validation (CSP without unsafe-inline/unsafe-eval, object-src/base-uri/frame-ancestors)
- Demo credentials endpoint (DEMO_MODE gating + no passwords in bundle)
- Retention policy/purge (admin/CSRF enforcement, old audit rows purged, cases untouched)
- Audit search (`q`/`actor` filters, auth required, `case_id`/`date` fields)
- Alert row-level scoping (department/assigned/shared pool, non-admin exclusion)
- Password policy + registration gate + rate-limit bypass under TESTING

**E2E (Playwright suite; run separately):**

- Landing page (5) — title, hero, CTA, problem statement
- Login (6) — form, demo buttons, error handling, register
- Dashboard (8) — stats, impact metrics, prediction, demo mode, user profile
- Map (3) — container, filter panel, risk tabs
- Predictions (2) — simulate section, disclaimer
- Navigation (5) — overview, map, cases, data privacy, live status

---

## Demo Strategy (Golden Path — 5 Minutes)

1. **Dashboard Overview** (10 sec) — 6 stat cards, impact metrics
2. **City Switching** (30 sec) — Switch between 8 cities, map updates with correct ATMs
3. **Simulate Transaction** (1 min) — Interactive, show validation, synthetic-record disclaimer
4. **Map Prediction** (1 min) — Risk-ranked locations, lead time, SHAP explainability
5. **NLP Triage** (1 min) — Paste complaint, entity extraction, non-cybercrime fallback
6. **Review Queue** (30 sec) — Approve/override/dismiss cases
7. **Data & Privacy** (30 sec) — Synthetic-data boundary, privacy controls, and future deployment considerations
8. **Mule Network** (30 sec) — Clustering, red/amber/green risk coloring
9. **Blockchain Ledger** (1 min) — Anchor evidence → auto-mine PoW block → run 3-node consensus

### If Backend Crashes

Red "Backend Offline — Demo Data" banner appears. Switch to backup video.

---

## Project Structure

```text
sih-prototype/
├── backend/
│   ├── main.py              # FastAPI — 56+ endpoints, request logging
│   ├── auth.py              # JWT, RBAC, CSRF, rate limiting
│   ├── encryption.py        # AES-256-GCM
│   ├── spatial.py           # PostGIS + haversine fallback
│   ├── ml_engine.py         # RF+XGBoost ensemble, SHAP, drift
│   ├── evidence_chain.py    # SHA-256 hash chain + Merkle tree
│   ├── blockchain.py        # PoW blockchain: mining, multi-node consensus
│   ├── email_client.py      # SMTP email alerts (optional)
│   ├── twilio_client.py     # Twilio SMS alerts (optional)
│   ├── models_db.py         # SQLAlchemy ORM models, including transaction_records
│   ├── database.py          # PostgreSQL/SQLite with optional PostGIS detection
│   ├── alembic/              # Schema migrations (0001–0003)
│   ├── city_data.py         # 8 cities, 64 ATMs with coordinates
│   ├── train_model.py       # Trains on 200k synthetic transactions
│   ├── generate_data.py     # Generates training data (400 ATMs, 200k txns)
│   ├── seed.py              # Seeds 64 ATMs, 23 cases, 77 audit logs
│   └── tests/               # pytest suite; run the command for the current count
├── frontend/
│   ├── src/
│   │   ├── pages/           # 8 page routes
│   │   ├── components/      # 26+ components (incl. BlockchainPanel)
│   │   ├── hooks/           # useDashboardData (city-aware), useWebSocket
│   │   ├── context/         # DashboardContext (with cityCenter)
│   │   ├── lib/auth.ts      # Token management, CSRF auto-fetch
│   │   ├── data/            # Fallback data for offline mode
│   │   └── test/            # Frontend tests
│   ├── e2e/                 # Playwright E2E tests
│   │   ├── landing.spec.ts
│   │   ├── login.spec.ts
│   │   ├── dashboard.spec.ts
│   │   ├── map.spec.ts
│   │   ├── predictions.spec.ts
│   │   └── navigation.spec.ts
│   ├── playwright.config.ts
│   └── package.json
├── docker-compose.yml
└── .env.example
```

---

## Synthetic Data Disclaimer

This prototype uses **only reproducible synthetic demonstration data**. No real or unauthorised banking, financial, crime, or government data is used. Runtime prediction records are stored in `transaction_records` and queried by the prediction engine; they are synthetic fixtures, not operational records. The model and operational simulation have not been validated on real data.

---

## Prepared Answers for Judges

**"Why isn't this real blockchain?"**
> "This is a local simulated multi-node prototype for evidence-custody demonstrations. It is not a real government network, public blockchain, or production trust system."

**"What's your accuracy on real data?"**
> "The reported accuracy is 97.7%, with 39.4% recall, 55.8% F1, and 0.446 PR-AUC on the synthetic holdout benchmark. These are synthetic-benchmark results, not real-world validation or deployment evidence. Retraining on authorised data would require a separate approved data and validation process."

**"Why is recall only 39.4%?"**
> "With 3.65% fraud rate and 200k samples, the model sees ~7,300 fraud cases. 39.4% recall means it catches ~2,876 of them. The tradeoff is high precision (95.8%) — very few false alarms. In production, you'd tune the decision threshold to prioritize recall over precision, or use SMOTE/class weighting. For this prototype, we show the raw metrics and let the analyst decide."

**"Why does training use 400 synthetic ATM records but the prototype runtime uses 64?"**
> "The 400 synthetic ATMs are used during model training for geographic variation across 8 cities. The prototype demonstration uses 64 synthetic ATM records. This is a fixture-size difference only; it does not establish real-world generalisation."

**"Where is Federated Learning implemented?"**
> "The architecture is designed to support Federated Learning for cross-bank model training without sharing raw data. For this prototype, we use centralized training with synthetic data."

**"Show me where PostGIS is used."**
> "PostGIS is an optional PostgreSQL integration path. The application reports extension availability and uses haversine fallback when it is absent. The integration fixture runs only when POSTGRES_TEST_DATABASE_URL is configured."

**"How do you prevent overfitting to synthetic data?"**
> "We used a stratified 80/20 split with 5-fold cross-validation on synthetic data. The model achieves 55.8% F1 and 0.446 PR-AUC on the synthetic holdout test set. We do not claim that these synthetic patterns transfer to real data, and this repository does not validate against real banking or government records."

**"How does city switching work?"**
> "The backend has 8 synthetic demonstration cities with fixture coordinates. When you switch cities, the system fetches city-specific predictions using the ML model, generates risk scores for each synthetic ATM, and the map remounts with the corresponding fixture center and locations. These fixtures do not represent verified operational infrastructure."

---

**Smart India Hackathon 2026**
**Problem Statement: PS-26184**
