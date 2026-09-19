# ATLAS - Advanced Threat Location & Alert System
## Smart India Hackathon 2026 — Problem Statement 26184

### What This Is

ATLAS is a cybercrime cash-out prediction platform. It takes complaint data, runs it through an ML pipeline, and predicts **where** the next ATM cash-out is likely to happen — giving law enforcement a lead time window to deploy.

### Honest Scope

**What's production-ready:**
- Security architecture (AES-256-GCM, JWT rotation, RBAC, CSRF, rate limiting, TLS)
- Cryptographic evidence chain-of-custody with tamper-evident verification
- Full-stack application with 49+ API endpoints, 39 passing backend tests, 29 passing E2E tests
- PostGIS spatial indexing with haversine fallback
- Multi-city support — 8 cities, 64 ATMs with live city switching on the map

**What's a working prototype needing real data:**
- The ML prediction model (trained on synthetic data — see accuracy note)
- NLP complaint triage (keyword-based, not transformer-based)
- Mule network graph analysis (demonstrates the concept, needs real transaction graphs)

**The honest pitch for judges:** "The security infrastructure and evidence chain are built to production standards. The ML pipeline is end-to-end functional and ready for real data. No public Indian cybercrime transaction dataset exists to validate the model against — that's a data access problem, not an engineering one."

---

## Security Architecture

This is where ATLAS is genuinely production-grade. Most hackathon projects stop at "we use JWT." We went deeper.

### Encryption at Rest
- **AES-256-GCM** — Authenticated encryption for sensitive fields (victim names, contacts, descriptions, alert messages)
- **PBKDF2-HMAC-SHA256** — 600,000 iteration key derivation (OWASP 2023 recommendation)
- **Transparent layer** — API encrypts on write, decrypts on read; no application code changes needed
- Implementation: `cryptography` library, 12-byte random nonce, base64-encoded ciphertext
- **Key management**: For the prototype, the AES key is stored in an environment variable. In production, this would use AWS KMS or HashiCorp Vault.

### Authentication & Authorization
- **JWT HS256** — Access tokens (1h) + refresh tokens (7d) with rotation
- **Refresh revocation** — Old tokens revoked on rotation; unique jti per token prevents replay
- **4 roles with granular permissions:**
  - `admin`: read, write, delete, override, manage_users
  - `inspector`: read, write, override
  - `analyst`: read, write
  - `bank_officer`: read, write (review queue access — bank officers flag false positives and override risk scores for their institution's cases)
- **bcrypt** — passlib CryptContext with auto-deprecation flag

### Network Security
- **TLS/HTTPS** — Supported via uvicorn SSL context (set SSL_CERTFILE and SSL_KEYFILE env vars; app starts without TLS if unset)
- **HSTS** — `max-age=31536000; includeSubDomains`
- **CORS** — Explicit allowed origins via `ALLOWED_ORIGINS` env var (not wildcard)
- **7 security headers** via middleware:
  - `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Rate Limiting (3 Layers)
1. **slowapi** — Global rate limiter on API endpoints (30/min predictions, 10/min mule-network, 20/min SHAP)
2. **Custom RateLimiter** — In-memory per-IP tracking on auth (5 login/15min, 3 register/15min, 10 refresh/15min; disabled in DEMO_MODE)
3. **WebSocket IP Tracker** — Max 5 concurrent connections per IP, exponential backoff reconnect

### Request Logging
- Middleware logs every request with method, path, status code, and response time (ms)
- Color-coded severity: green (<200ms), yellow (200-500ms), red (>500ms)
- Uvicorn access log enabled for full HTTP request tracing

### CSRF Protection
- Token-based on all state-changing POST endpoints
- Token served via `GET /api/csrf-token` (requires auth)
- 1-hour token expiry
- Frontend auto-fetches CSRF token for all state-changing requests

---

## Tamper-Evident Evidence Chain

**This is a SHA-256 hash chain with Merkle tree verification — not a blockchain.**

There are no consensus mechanisms, no distributed nodes, no mining. What we built:
- **SHA-256 hash chain** — Each evidence record's hash includes the previous record's hash, creating an unbreakable sequential chain
- **Merkle tree** — Binary tree of hashes enabling efficient tamper verification via Merkle proofs (O(log n) verification)
- **File-backed persistence** — JSON file storage, designed for single-node law enforcement deployment
- **Chain-of-custody tracking** — Who added what, when, with cryptographic proof of integrity

This is the right architecture for a law enforcement evidence management system. It's simpler than blockchain, more auditable, and doesn't require distributed consensus for a single-agency tool.

---

## ML Pipeline

### What We Built
An end-to-end prediction pipeline that:
1. Takes complaint/case data as input
2. Engineers features (amount, time, location, linked accounts)
3. Runs ensemble scoring (Random Forest + XGBoost)
4. Ranks nearby ATM locations by risk score (capped at 99%)
5. Generates SHAP-based explainability for each prediction (cached per case for demo performance)
6. Returns expected time window and confidence

### Training Data
Trained on **200,000+ synthetic transactions** across **400 ATMs in 8 Indian cities** with a ~3.65% fraud rate — consistent with RBI-reported figures for digital payment fraud. The 200k transactions are used to train the ML model offline. The live database stores 64 ATMs (8 per city) for runtime prediction — these are a curated subset used for real-time scoring.

### Model Performance (Fraud Class — Imbalanced Data)
| Metric | Value | What it means |
|--------|-------|---------------|
| **Recall** | 39.4% | Fraud cases correctly detected |
| **F1 Score** | 55.8% | Precision-recall balance |
| **Precision** | 95.8% | Alerts that are real fraud |
| **PR-AUC** | 0.446 | Precision-recall curve quality |
| **ROC AUC** | 0.720 | Ranking quality |
| **Accuracy** | 97.7% | Inflated by 96.35% majority class |

> **Note:** Accuracy is misleading on imbalanced data (1 in 27 transactions is fraud). We lead with Recall and F1 — the metrics that matter for fraud detection.

### What the Model Does
- **Ensemble**: RandomForestClassifier (100 trees) + XGBoostClassifier (100 estimators), weighted averaging (60/40)
- **Features**: 8 engineered features — amount, hour, day_of_week, distance from victim, area_risk, zone_multiplier, linked_accounts, is_night
- **Explainability**: SHAP KernelExplainer with per-case result caching (explainer initialized once, results cached to avoid repeated slow computation during demos)

### Supporting Components
- **Drift Monitoring**: Population Stability Index tracks if live prediction distribution diverges from training
- **Anomaly Detection**: Isolation Forest flags unusual transaction patterns (sklearn defaults — functional for demo, would need tuning on real data)
- **Mule Network**: NetworkX Louvain community detection on transaction graphs (demonstrates concept; needs real transaction network data to be meaningful)
- **NLP Triage**: Keyword-based complaint classification with fallback for non-cybercrime input

---

## Tech Stack

### Frontend
| Category | Technology |
|----------|-----------|
| Framework | React 18.3 |
| Build Tool | Vite 5.4 |
| Language | TypeScript 5.6 (strict mode) |
| Styling | Tailwind CSS 3.4 + daisyUI 5.7 |
| State | React Context + motion.dev |
| Charts | Recharts |
| Maps | Leaflet (react-leaflet) |
| Graph | d3-force, react-force-graph-2d |
| Routing | React Router 6 |

### Backend
| Category | Technology |
|----------|-----------|
| Runtime | Python 3.13 |
| Framework | FastAPI 0.115 |
| ORM | SQLAlchemy 2.0 |
| Database | PostgreSQL 16 (Supabase) / SQLite fallback |
| Spatial | PostGIS auto-detection with haversine fallback |
| Auth | python-jose (JWT HS256), passlib (bcrypt 4.0.1) |
| TLS | uvicorn SSL context (cert-dependent) |
| Evidence Chain | hashlib SHA-256, Merkle tree |
| SMS / Email | Twilio 8.2 + Standard SMTP |

### AI/ML
| Category | Technology |
|----------|-----------|
| Ensemble | scikit-learn 1.5 (RandomForest) + XGBoost 2.1 |
| Explainability | SHAP 0.46 (KernelExplainer, cached) |
| Graph Analysis | NetworkX 3.3 (Louvain community detection) |
| Anomaly Detection | scikit-learn IsolationForest |
| Data | Pandas 2.2, NumPy 1.26 |

---

## API Endpoints (49+)

### Authentication
| Method | Endpoint | CSRF | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | — | Login (returns access + refresh tokens) |
| POST | `/api/auth/register` | — | Register new user (pending approval) |
| POST | `/api/auth/refresh` | — | Refresh access token (revokes old) |
| GET | `/api/auth/me` | — | Current user info |
| PUT | `/api/auth/me` | — | Update profile (name, badge, department) |
| POST | `/api/auth/change-password` | — | Change password (requires current password) |
| GET | `/api/csrf-token` | — | Get CSRF token (requires auth) |
| POST | `/api/auth/approve/{user_id}` | Yes | Approve registered user (admin only) |

### Core Data
| Method | Endpoint | CSRF | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | — | Health check |
| GET | `/api/dashboard` | — | Dashboard statistics (includes impact metrics) |
| GET | `/api/cases` | — | List cases (sensitive fields decrypted) |
| GET | `/api/predictions` | — | All predictions |
| GET | `/api/predictions/{case_id}` | — | Prediction for case |

### Transactions & Alerts
| Method | Endpoint | CSRF | Description |
|--------|----------|------|-------------|
| POST | `/api/transactions` | Yes | Simulate cash-out transaction (ephemeral, not stored) |
| GET | `/api/alerts` | — | Active alerts |
| POST | `/api/alerts` | Yes | Create alert |
| POST | `/api/alerts/{id}/acknowledge` | Yes | Acknowledge alert |

### Evidence & Review
| Method | Endpoint | CSRF | Description |
|--------|----------|------|-------------|
| POST | `/api/evidence/anchor` | Yes | Anchor evidence to hash chain |
| GET | `/api/evidence/chain` | — | Full evidence chain |
| GET | `/api/review/queue` | — | Pending review items |
| POST | `/api/review/{case_id}` | Yes | Approve / override / dismiss |

### ML Model
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/model/card` | Model metadata + training info |
| GET | `/api/model/metrics` | Precision / recall / F1 per class |
| GET | `/api/model/drift` | PSI drift analysis |
| GET | `/api/model/shap/{case_id}` | SHAP feature contributions (cached) |
| GET | `/api/model/mule-network` | Graph-based mule detection |
| POST | `/api/model/detect-anomaly` | Isolation Forest anomaly score |

### Spatial & GIS
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/model/spatial` | Spatial engine status |
| POST | `/api/model/spatial/enable-postgis` | Enable PostGIS + spatial index |
| GET | `/api/model/spatial/nearby` | Find nearby ATMs |

### NLP & Cities
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/nlp/triage` | Complaint text analysis |
| GET | `/api/cities` | All 8 supported cities |
| GET | `/api/cities/{city}/atms` | ATMs in city |
| GET | `/api/cities/{city}/predictions` | ML predictions for city |

### Field Outcomes
| Method | Endpoint | CSRF | Description |
|--------|----------|------|-------------|
| POST | `/api/field-outcomes` | Yes | Record investigation outcome |
| GET | `/api/field-outcomes` | — | List all field outcomes |

### WebSocket
| Protocol | Endpoint | Description |
|----------|----------|-------------|
| WS | `/ws?token=<jwt>` | Real-time alerts (authenticated) |

---

## Demo Credentials

> **Note:** These are plaintext demo credentials for hackathon evaluation only. In the actual system, passwords are hashed with PBKDF2-HMAC-SHA256 (600k iterations), never stored or transmitted in plaintext. These exist solely so judges can log in quickly during the demo.

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| Admin | admin@atlas.gov | admin123 | Full access |
| Inspector | inspector@atlas.gov | inspector123 | Read, write, override |
| Analyst | analyst@atlas.gov | analyst123 | Read, write |
| Bank Officer | bank@atlas.gov | bank123 | Read, write |

---

## How to Run

### Prerequisites
- Python 3.13+
- Node.js 20+
- (Optional) Docker + Docker Compose

### 1. Backend
```bash
cd backend
python -m pip install -r requirements.txt
cp ../.env.example .env
# Edit .env with your secrets
python -m uvicorn main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**

### 3. Docker
```bash
docker compose up --build
```

### 4. Seed Database (Optional)
```bash
cd backend
python seed.py
```
Seeds 64 ATMs across 8 cities, 23 cases, 20 suspects, 77 audit logs, 7 field outcomes, and 17 predictions.

---

## Environment Variables

Create `backend/.env` (git-ignored):

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

# Twilio & Email (optional, no hardcoded fallbacks)
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

## Test Suites

```bash
# Backend — 39 tests passing, 1 skipped
cd backend && python -m pytest tests/ -v

# Frontend — TypeScript strict mode
cd frontend && npx tsc --noEmit

# E2E — Playwright (29 tests, Chromium)
cd frontend && npx playwright test
```

### What We Test
**Backend (39 tests):**
- Authentication (login, register, refresh, token reuse detection)
- RBAC (all 4 roles for read/write/override permissions)
- CSRF protection on state-changing endpoints
- Evidence chain (anchor, verify, list)
- ML endpoints (predictions, model card, metrics, drift, SHAP, mule network, anomaly)
- NLP triage (vishing, UPI fraud, non-cybercrime fallback)
- City endpoints (list, info, ATMs, predictions)
- Security headers validation
- Component rendering (all major frontend pages)

**E2E (29 tests):**
- Landing page (5 tests) — title, hero, CTA, problem statement
- Login page (6 tests) — form, demo buttons, error handling, register flow
- Dashboard (8 tests) — stats, impact metrics, prediction card, demo mode, user profile
- Map (3 tests) — container, filter panel, risk tabs
- Predictions (2 tests) — simulate section, ephemeral disclaimer
- Navigation (5 tests) — overview, map, cases, data privacy, live status

---

## Demo Strategy (For Team Reference)

### Golden Path — 5 Minute Flow
1. **Dashboard Overview** (10 sec) — Show 6 stat cards including Impact metrics (Estimated Exposure, Mules Flagged)
2. **City Switching** (30 sec) — Switch between 8 cities, map updates with correct ATMs and risk scores
3. **Simulate Transaction** (1 min) — Interactive demo, show ephemeral disclaimer, amount validation (₹100–₹10L)
4. **Map Prediction** (1 min) — Show risk-ranked locations, lead time, SHAP explainability
5. **NLP Triage** (1 min) — Paste a complaint, show entity extraction, handle non-cybercrime input gracefully
6. **Review Queue** (30 sec) — Approve/override/dismiss cases, show action buttons working
7. **Data & Privacy** (30 sec) — Explain synthetic data, RBI/DPDP compliance, production architecture
8. **Mule Network Graph** (30 sec) — Show clustering, red/amber/green risk coloring

### Mentioned, Not Demoed Live
- Audit Trail — Government portal-style activity log with type filtering
- Case Registry — Full CRUD with PII encryption/decryption
- Evidence Chain — SHA-256 hash chain with Merkle verification
- Drift monitoring — PSI tracking for model health
- Anomaly detection — Isolation Forest for unusual patterns
- Email Alerts — SMTP-based alert delivery (optional, gracefully skips without credentials)

### If the Backend Crashes
The UI shows a **red "Backend Offline — Demo Data" banner** with cached fallback data. Say: "Let me show you a recorded walkthrough" and switch to the backup video.

### Prepared Answers

**"Why isn't this real blockchain?"**
> "Blockchain requires distributed consensus across multiple untrusting nodes. Law enforcement evidence management is a single-agency use case — there's one evidence custodian, not competing parties who need consensus. A SHA-256 hash chain with Merkle proofs gives us tamper-evident verification with O(log n) proof validation, which is the right tool for this problem. Blockchain would add complexity without solving a real problem here."

**"What's your accuracy on real data?"**
> "The accuracy is 97.7%, but that's misleading — fraud is only 3.65% of transactions. The real question is: of the actual fraud cases, how many do we catch? That's our recall: 39.4%. On imbalanced data, F1 score (55.8%) and PR-AUC (0.446) are the meaningful metrics. Our precision is 95.8% — when the model flags fraud, it's right 95.8% of the time. No public Indian cybercrime transaction dataset exists to validate against — the pipeline is designed to retrain on authorized real data when access is granted."

**"Why is recall only 39.4%?"**
> "With 3.65% fraud rate and 200k samples, the model sees ~7,300 fraud cases. 39.4% recall means it catches ~2,876 of them. The tradeoff is high precision (95.8%) — very few false alarms. In production, you'd tune the decision threshold to prioritize recall over precision, or use SMOTE/class weighting. For this prototype, we show the raw metrics and let the analyst decide."

**"Why does training use 400 ATMs but the live system only has 64?"**
> "The 400 ATMs are used during model training to ensure geographic diversity across 8 cities — 50 ATMs per city gives the model enough spatial variation to learn distance-based features. The live system uses 64 ATMs (8 per city) — the highest-risk, most operationally relevant locations for real-time prediction. The model generalizes because it was trained on a superset."

**"Where is Federated Learning implemented?"**
> "The architecture is designed to support Federated Learning for cross-bank model training without sharing raw data. For this prototype, we use a centralized training approach with synthetic data. The production architecture document describes the intended multi-institution deployment model."

**"Show me where PostGIS is used."**
> "The system auto-detects PostGIS availability at startup. If the extension is installed, it uses spatial index queries with ST_DWithin. Otherwise, it falls back to haversine distance calculations. Both paths produce the same results — PostGIS is faster at scale."

---

## Project Structure

```
sih-prototype/
├── backend/
│   ├── main.py              # FastAPI — 49+ endpoints, CORS, CSP, security middleware, request logging
│   ├── auth.py              # JWT auth, RBAC, refresh rotation, CSRF, rate limiting
│   ├── encryption.py        # AES-256-GCM encryption for data at rest
│   ├── spatial.py           # PostGIS spatial queries with haversine fallback
│   ├── ml_engine.py         # Ensemble RF+XGBoost, SHAP (cached), drift, anomaly
│   ├── evidence_chain.py    # SHA-256 hash chain with Merkle tree
│   ├── email_client.py      # SMTP email alerts (optional, gracefully skips)
│   ├── twilio_client.py     # Twilio SMS alerts (optional, gracefully skips)
│   ├── models_db.py         # SQLAlchemy ORM models
│   ├── database.py          # SQLite/PostgreSQL engine with PostGIS auto-detection
│   ├── city_data.py         # 8 cities, 8 ATMs each with verified coordinates
│   ├── train_model.py       # Trains RF + XGBoost on 200k synthetic transactions
│   ├── generate_data.py     # Generates 400 ATMs, 200k transactions for training
│   ├── seed.py              # Seeds 64 ATMs, 23 cases, 77 audit logs, 7 field outcomes
│   ├── requirements.txt     # Python dependencies
│   └── tests/               # 39 backend tests
├── frontend/
│   ├── src/
│   │   ├── pages/           # 8 page routes (DashboardLayout wrapper)
│   │   ├── components/      # 25+ reusable components
│   │   │   ├── TopNav.tsx   # City selector, red offline banner, scenario runner, demo mode indicator
│   │   │   ├── MapView.tsx  # Leaflet map with city-based remount, risk-colored markers
│   │   │   ├── ReviewQueue.tsx  # Approve/override/dismiss with proper click handling
│   │   │   ├── AuditLog.tsx # Government portal-style activity log with type filtering
│   │   │   ├── RankedLocationsTable.tsx  # Sticky headers, risk-colored rows
│   │   │   ├── MuleNetworkGraph.tsx  # Enhanced legend with "How to Read"
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── useDashboardData.ts  # City-aware data fetching, cityCenter tracking
│   │   │   └── useWebSocket.ts      # WebSocket connection management
│   │   ├── context/
│   │   │   └── DashboardContext.tsx  # Shared state with cityCenter
│   │   ├── lib/auth.ts      # Token management, auto-refresh, CSRF auto-fetch
│   │   ├── data/fallbackData.ts  # Cached demo data for offline mode
│   │   └── test/            # Frontend tests
│   ├── e2e/                 # 29 Playwright E2E tests
│   │   ├── landing.spec.ts
│   │   ├── login.spec.ts
│   │   ├── dashboard.spec.ts
│   │   ├── map.spec.ts
│   │   ├── predictions.spec.ts
│   │   └── navigation.spec.ts
│   ├── playwright.config.ts
│   └── package.json
├── docker-compose.yml       # 3 services: backend, frontend, PostgreSQL
└── .env.example
```

---

## Key Features Added During Development

### Multi-City Support
- **8 cities with 8 ATMs each** (64 total) — Puducherry, Chennai, Delhi, Mumbai, Bangalore, Kolkata, Hyderabad, Ahmedabad
- **Live city switching** — Dropdown in TopNav, map re-centers with correct ATMs and risk scores
- **City-specific predictions** — Backend generates ML predictions per city using city-specific ATM coordinates
- **MapContainer key-based remount** — Ensures Leaflet re-renders correctly on city change

### Demo Mode & Resilience
- **Red offline banner** — Prominent alert when backend is unreachable
- **Scenario runner** — 3 pre-baked demo scenarios in TopNav dropdown
- **Demo login dropdown** — Quick-login buttons for all 4 roles on login page
- **Fallback data** — Cached data for offline demo continuity

### Impact Metrics
- **Prevented Fraud** — Sum of resolved case amounts (₹X.XL format)
- **Mules Flagged** — Count of high-risk ranked locations
- **Dynamic avg_lead_time** — Computed from DB resolution rate, not hardcoded

### Audit Trail
- **Government portal style** — Clean, structured activity log with proper icons and type badges
- **Type filtering** — Filter by alert, prediction, case, system, review, search
- **No neon effects** — Professional appearance matching govt portal aesthetic

### Alert System
- **Email alerts** — SMTP-based delivery via `email_client.py`, optional, gracefully skips without credentials
- **SMS alerts** — Twilio integration, optional
- **WebSocket real-time** — Live alert notifications

### Data Integrity
- **Training data clarity** — UI clearly states 200k is training data, live DB stores aggregated scores
- **PostGIS honesty** — "Auto-detection with haversine fallback" not "PostGIS required"
- **Federated Learning** — Softened to "Architecture designed to support..."
- **Simulation disclaimer** — "Simulated transactions are ephemeral and not stored"

### User Experience
- **Sticky table headers** — Headers stay visible when scrolling long tables
- **Global Demo Mode indicator** — Single pulse dot in TopNav replaces per-panel tags
- **Transaction validation** — Amount must be ₹100–₹10,00,000
- **NLP fallback** — Non-cybercrime input shows "Unrecognized Complaint Format" with guidance
- **Review Queue** — Approve/override/dismiss with proper form interaction (no panel collapse on button click)

### Testing
- **29 Playwright E2E tests** — Landing, login, dashboard, map, predictions, navigation
- **39 backend pytest tests** — Auth, RBAC, CSRF, evidence chain, ML, NLP, cities, security
- **TypeScript strict mode** — Zero errors across entire frontend

---

## Synthetic Data Disclaimer

This prototype uses **entirely synthetic demonstration data**. No real banking, financial, or government data is used. All case IDs, amounts, locations, ATM coordinates, and risk scores are fabricated. The ML model needs real Indian cybercrime transaction data to validate — such a dataset does not currently exist publicly.

---

## License

Security-hardened prototype for Smart India Hackathon 2026. Built to demonstrate production-grade security architecture and evidence chain integrity. Would require additional security audit, penetration testing, and real data validation before deployment.
