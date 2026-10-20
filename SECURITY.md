# Security Policy

## Project status

ATLAS is a **Smart India Hackathon 2026 prototype** (problem statement PS-26184): a decision-support console built and demonstrated on **synthetic data**. It is not a production or operational system, and no security assurance is made for real deployments.

## Demo posture is not production hardening

`DEMO_MODE=true` deliberately relaxes several controls so the bundled synthetic dataset can be loaded and explored locally. Specifically, it:

- permits development signing secrets instead of failing closed (`backend/security_config.py`);
- permits the fixed demo encryption key instead of requiring `ENCRYPTION_KEY`;
- raises authentication rate limits (login / register / refresh) and lifts the auth lockout path (`backend/auth.py`);
- defaults the refresh cookie's `Secure` flag to false (`backend/auth.py`);
- enables self-registration by default and seeds demo users;
- exposes `/docs`, `/redoc`, `/openapi.json` and the demo-credential endpoint.

**Alert dispatch is not controlled by `DEMO_MODE`.** SMS and email sending are governed separately by `ALERTS_SMS_ENABLED`, `ALERTS_EMAIL_ENABLED`, the cooldown, and the per-day caps in `backend/main.py`.

A deployment handling real data must run with `DEMO_MODE` unset, unique secrets supplied through the environment, `ENCRYPTION_KEY` set, `COOKIE_SECURE=true`, and TLS terminated by a configured certificate or an authorised reverse proxy.

## Reporting a vulnerability

Use GitHub's **private vulnerability reporting** for this repository (Security → Report a vulnerability). Do not open a public issue for a suspected vulnerability.

There is no security response SLA; this is a hackathon prototype rather than a maintained product.

## Scope

In scope:

- authentication, session handling and CSRF enforcement (`backend/auth.py`);
- role checks and case visibility (`backend/access_control.py`);
- at-rest field and evidence encryption (`backend/encryption.py`, `backend/security_config.py`);
- evidence-chain and ledger integrity (`backend/evidence_chain.py`, `backend/blockchain.py`).

Out of scope:

- denial of service against the demo host or model inference;
- anything requiring real NCRP, bank, or telecom data;
- findings that only reproduce with `DEMO_MODE=true` and the published demo credentials — that configuration is documented here as non-production.

## Data handling

All fixtures are synthetic. `backend/.env` is gitignored; only `.env.example` files are tracked, and no real credentials are stored in the repository.
