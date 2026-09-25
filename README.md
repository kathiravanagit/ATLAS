# ATLAS — Advanced Threat Location & Alert System

## Smart India Hackathon 2026 — Problem Statement 26184

### What This Is

ATLAS is a cybercrime cash-out prediction platform. It takes complaint data, runs it through an ML pipeline, and predicts **where** the next ATM cash-out is likely to happen — giving law enforcement a lead time window to deploy.

### Honest Scope

**What's production-ready:**

- Security architecture (AES-256-GCM, JWT rotation, RBAC, CSRF, rate limiting, TLS)
- Cryptographic evidence chain-of-custody with tamper-evident verification
- Full-stack application with 54+ API endpoints, 110 passing backend tests, 29 passing E2E tests
- PostGIS spatial indexing with haversine fallback
- Multi-city support — 8 cities, 64 ATMs with live city switching on the map

**What's a working prototype needing real data:**

- The ML prediction model (trained on synthetic data — see accuracy note)
- NLP complaint triage (keyword-based, not transformer-based)
- Mule network graph analysis (demonstrates the concept, needs real transaction graphs)

**The honest pitch for judges:** "The security infrastructure and evidence chain are built to production standards. The ML pipeline is end-to-end functional and ready for real data. No public Indian cybercrime transaction dataset exists to validate the model against — that's a data access problem, not an engineering one."

---

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

### Backend

Python 3.13 · FastAPI 0.115 · SQLAlchemy 2.0 · PostgreSQL 16 (Supabase) / SQLite · PostGIS (auto-detect) · python-jose · passlib

### AI/ML

scikit-learn 1.5 (RandomForest) · XGBoost 2.1 · SHAP 0.46 · NetworkX 3.3 (Louvain) · IsolationForest · Pandas · NumPy

---

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 20+
- (Optional) PostgreSQL with PostGIS

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env    # configure secrets
uvicorn main:app --reload --port 8000
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

---

## Demo Credentials

| Role | Email | Password |
| ------ | ------- | ---------- |
| Admin | <admin@atlas.gov> | admin123 |
| Inspector | <inspector@atlas.gov> | inspector123 |
| Analyst | <analyst@atlas.gov> | analyst123 |
| Bank Officer | <bank@atlas.gov> | bank123 |

> Demo credentials are plaintext for hackathon evaluation only. Production uses hashed passwords.

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

```
sih-prototype/
├── backend/
│   ├── main.py              # FastAPI app — 54+ endpoints
│   ├── auth.py              # JWT, RBAC, CSRF, rate limiting
│   ├── encryption.py        # AES-256-GCM encryption
│   ├── ml_engine.py         # RF+XGBoost ensemble, SHAP, drift
│   ├── evidence_chain.py    # SHA-256 hash chain + Merkle tree
│   ├── blockchain.py        # PoW blockchain: mining, multi-node consensus
│   ├── spatial.py           # PostGIS / haversine fallback
│   ├── seed.py              # Database seeder
│   ├── city_data.py         # 8 cities, 64 ATMs
│   └── tests/               # 104 pytest tests
├── frontend/
│   ├── src/
│   │   ├── pages/           # 8 route pages
│   │   ├── components/      # 26+ components (incl. BlockchainPanel)
│   │   ├── hooks/           # Data fetching, WebSocket
│   │   └── lib/             # Auth, utilities
│   └── e2e/                 # 29 Playwright tests
├── docker-compose.yml
└── .env.example
```

---

## Testing

```bash
# Backend (104 tests)
cd backend && python -m pytest tests/ -v

# Frontend (TypeScript strict)
cd frontend && npx tsc --noEmit

# E2E (29 Playwright tests)
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

Deliberate tradeoff: the threshold is tuned for **high precision to avoid alert fatigue** for officers, at the cost of recall on a 3.6%-minority class. The model is **decision support, not an enforcement decision** — every flagged case requires human review. No public Indian cybercrime transaction dataset exists to validate against; the pipeline is designed to retrain on authorized data.

---

## Data Disclaimer

This prototype uses **entirely synthetic demonstration data**. No real banking, financial, or government data is used. All case IDs, amounts, locations, ATM coordinates, and risk scores are fabricated. The ML model requires authorized Indian cybercrime transaction data for production validation.

---

## License

Security-hardened prototype for Smart India Hackathon 2026. Built to demonstrate production-grade security architecture and evidence chain integrity.
