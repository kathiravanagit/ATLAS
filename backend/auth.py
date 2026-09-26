"""
JWT Authentication with role-based access control + refresh token rotation.
Roles: inspector, analyst, bank_officer, admin
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Query, WebSocket, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models_db import User, RefreshToken
import hashlib
import secrets
import time
import uuid
import os
from collections import defaultdict

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-do-not-use-in-production")
REFRESH_SECRET_KEY = os.getenv("REFRESH_SECRET_KEY", "dev-refresh-secret-do-not-use-in-production")
if not os.getenv("SECRET_KEY"):
    import warnings
    warnings.warn("SECRET_KEY env var not set — using insecure dev default. Set SECRET_KEY in production!", stacklevel=2)
if not os.getenv("REFRESH_SECRET_KEY"):
    import warnings
    warnings.warn("REFRESH_SECRET_KEY env var not set — using insecure dev default. Set REFRESH_SECRET_KEY in production!", stacklevel=2)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")
# Self-registration is a demo affordance, off by default for production deployments.
REGISTRATION_ENABLED = os.getenv(
    "REGISTRATION_ENABLED", "true" if DEMO_MODE else "false"
).lower() in ("true", "1", "yes")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# ── Password Policy ───────────────────────────────────────────────────────────

def validate_password_policy(password: str) -> None:
    """Minimum bar: 8+ chars with at least one letter and one digit."""
    if len(password) < 8 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters and include both a letter and a number",
        )

# ── Rate Limiting ─────────────────────────────────────────────────────────────

class RateLimiter:
    """Simple in-memory rate limiter per IP."""

    def __init__(self):
        self._attempts: dict[str, list[float]] = defaultdict(list)
        self._window = 900  # 15 minutes
        self._max_attempts = {
            "login": 999 if DEMO_MODE else 20,
            "register": 999 if DEMO_MODE else 3,
            "refresh": 999 if DEMO_MODE else 10,
        }

    def is_rate_limited(self, ip: str, action: str) -> tuple[bool, int]:
        if DEMO_MODE or os.getenv("TESTING") == "1":
            return False, 0
        now = time.time()
        cutoff = now - self._window
        key = f"{ip}:{action}"

        self._attempts[key] = [t for t in self._attempts[key] if t > cutoff]
        max_att = self._max_attempts.get(action, 5)

        if len(self._attempts[key]) >= max_att:
            wait = int(self._attempts[key][0] + self._window - now) + 1
            return True, wait

        self._attempts[key].append(now)
        return False, 0

    def reset(self, ip: str, action: str):
        key = f"{ip}:{action}"
        self._attempts.pop(key, None)

rate_limiter = RateLimiter()


# ── CSRF Protection ───────────────────────────────────────────────────────────

_csrf_tokens: dict[str, float] = {}

def generate_csrf_token(session_id: str) -> str:
    token = secrets.token_hex(32)
    _csrf_tokens[token] = time.time()
    # Cleanup old tokens (1h expiry)
    cutoff = time.time() - 3600
    expired = [k for k, v in _csrf_tokens.items() if v < cutoff]
    for k in expired:
        _csrf_tokens.pop(k, None)
    return token

def verify_csrf_token(token: str) -> bool:
    if not token or token not in _csrf_tokens:
        return False
    created = _csrf_tokens[token]
    return (time.time() - created) < 3600


def require_csrf(request: Request):
    """Dependency that enforces CSRF token on state-changing requests."""
    # Skip for GET/HEAD/OPTIONS (safe methods)
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    csrf = request.headers.get("X-CSRF-Token") or request.headers.get("X-CSRF-Token", "")
    if not csrf:
        print(f"[CSRF] Missing header. Method={request.method} Path={request.url.path}")
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Missing X-CSRF-Token header")
    if not verify_csrf_token(csrf):
        print(f"[CSRF] Invalid token. Method={request.method} Path={request.url.path} Token={csrf[:12]}...")
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Invalid or expired CSRF token")


# ── IP Tracking for WebSocket ─────────────────────────────────────────────────

class WebSocketIPTracker:
    """Per-session WebSocket connection tracker. Max 3 concurrent connections per user."""
    def __init__(self):
        self._connections: dict[str, int] = defaultdict(int)
        self._max_per_session = 3

    def can_connect(self, session_id: str) -> bool:
        return self._connections[session_id] < self._max_per_session

    def connect(self, session_id: str):
        self._connections[session_id] += 1

    def disconnect(self, session_id: str):
        self._connections[session_id] = max(0, self._connections[session_id] - 1)

ws_tracker = WebSocketIPTracker()

ROLE_permissions = {
    "admin": ["read", "write", "override", "manage_users"],
    "inspector": ["read", "write", "override"],
    "analyst": ["read", "write"],
    "bank_officer": ["read", "write"],
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "analyst"
    department: str = ""

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict

class RefreshRequest(BaseModel):
    refresh_token: str = ""  # optional: HttpOnly cookie is the primary channel

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    role: str
    badge: str
    department: str
    permissions: list[str]
    created_at: str | None = None
    last_login: str | None = None

class UpdateProfileRequest(BaseModel):
    name: str | None = None
    badge: str | None = None
    department: str | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh", "jti": uuid.uuid4().hex})
    return jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

DEMO_USER_SEEDS = [
    {"id": "INS-001", "name": "Inspector Rajesh Kumar", "email": "inspector@atlas.gov",
     "password": "inspector123", "role": "inspector", "badge": "IPB-2026-0471", "department": "Cybercrime Division"},
    {"id": "ANL-001", "name": "Analyst Priya Sharma", "email": "analyst@atlas.gov",
     "password": "analyst123", "role": "analyst", "badge": "ANB-2026-0123", "department": "Intelligence Unit"},
    {"id": "BNK-001", "name": "Bank Officer Amit Patel", "email": "bank@atlas.gov",
     "password": "bank123", "role": "bank_officer", "badge": "BBF-2026-0089", "department": "Financial Crimes Wing"},
    {"id": "ADM-001", "name": "Admin Suresh Nair", "email": "admin@atlas.gov",
     "password": "admin123", "role": "admin", "badge": "ADB-2026-0001", "department": "National Cyber Division"},
]


def seed_demo_users(db: Session):
    """Create demo users if they don't exist."""
    demo_users = DEMO_USER_SEEDS
    for u in demo_users:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            user = User(
                id=u["id"], name=u["name"], email=u["email"],
                hashed_password=pwd_context.hash(u["password"]),
                role=u["role"], badge=u["badge"], department=u["department"],
            )
            db.add(user)
    db.commit()


# ── Dependencies ──────────────────────────────────────────────────────────────

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> dict:
    token = credentials.credentials
    payload = decode_access_token(token)
    email = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = get_user_by_email(db, email)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "badge": user.badge,
        "department": getattr(user, "department", ""),
        "permissions": ROLE_permissions.get(user.role, ["read"]),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }

def require_role(*roles):
    def role_checker(user: dict = Depends(verify_token)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Required role: {', '.join(roles)}. Your role: {user['role']}")
        return user
    return role_checker

def require_permission(permission: str):
    def perm_checker(user: dict = Depends(verify_token)):
        if permission not in user.get("permissions", []):
            print(f"[PERM] Denied: user={user.get('email')} role={user.get('role')} permissions={user.get('permissions')} need={permission}")
            raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
        return user
    return perm_checker

def verify_ws_token(token: str, db: Session) -> Optional[dict]:
    """Verify a WebSocket token from query param."""
    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
        if email is None:
            return None
        user = get_user_by_email(db, email)
        if user is None or not user.is_active:
            return None
        return {
            "id": user.id, "name": user.name, "email": user.email,
            "role": user.role, "badge": user.badge,
            "department": getattr(user, "department", ""),
            "permissions": ROLE_permissions.get(user.role, ["read"]),
        }
    except HTTPException:
        return None


# ── WebSocket Short-Lived Ticket ──────────────────────────────────────────────
# Tickets are single-use, valid for 30 seconds, to avoid JWT-in-URL leakage.

_ws_tickets: dict[str, tuple[float, dict]] = {}  # ticket -> (expiry, user_info)
_WS_TICKET_TTL = 30  # seconds

def generate_ws_ticket(user_info: dict) -> str:
    """Generate a short-lived single-use WebSocket ticket carrying user info."""
    import secrets
    ticket = secrets.token_urlsafe(32)
    _ws_tickets[ticket] = (time.time() + _WS_TICKET_TTL, user_info)
    # Clean expired tickets
    now = time.time()
    expired = [k for k, v in _ws_tickets.items() if v[0] < now]
    for k in expired:
        _ws_tickets.pop(k, None)
    return ticket

def consume_ws_ticket(ticket: str) -> Optional[dict]:
    """Consume a WebSocket ticket (single-use, 30s TTL). Returns user info if valid, None otherwise."""
    entry = _ws_tickets.pop(ticket, None)
    if entry is None:
        return None
    expiry, user_info = entry
    if time.time() > expiry:
        return None
    return user_info


# ── Auth Endpoints ────────────────────────────────────────────────────────────

def register_auth_routes(app):
    @app.post("/api/auth/login", response_model=TokenResponse)
    def login(request: Request, response: Response, req: LoginRequest, db: Session = Depends(get_db)):
        client_ip = request.client.host if request.client else "unknown"
        limited, wait = rate_limiter.is_rate_limited(client_ip, "login")
        if limited:
            raise HTTPException(
                status_code=429,
                detail=f"Too many login attempts. Try again in {wait} seconds.",
                headers={"Retry-After": str(wait)},
            )
        user = get_user_by_email(db, req.email)
        if not user or not pwd_context.verify(req.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account deactivated")

        if not user.is_approved:
            raise HTTPException(status_code=403, detail="Account pending admin approval. Contact your administrator.")

        # Update last login
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        rate_limiter.reset(client_ip, "login")

        # Create tokens
        access_token = create_access_token({"sub": user.email, "role": user.role})
        refresh_token = create_refresh_token({"sub": user.email, "role": user.role})

        # Store refresh token in DB
        db_refresh = RefreshToken(
            token=refresh_token,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(db_refresh)
        db.commit()

        # HttpOnly refresh cookie: JS never reads the refresh token (XSS mitigation).
        # The body still carries it for API clients/tests; browsers should prefer the cookie.
        response.set_cookie(
            "atlas_refresh",
            refresh_token,
            max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
            httponly=True,
            secure=os.getenv("COOKIE_SECURE", "false").lower() in ("true", "1", "yes"),
            samesite="strict",
            path="/api/auth",
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user={
                "id": user.id, "name": user.name, "email": user.email,
                "role": user.role, "badge": user.badge,
                "department": getattr(user, "department", ""),
            }
        )

    @app.post("/api/auth/register", response_model=TokenResponse)
    def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
        if not REGISTRATION_ENABLED:
            raise HTTPException(
                status_code=403,
                detail="Self-registration is disabled. Ask your administrator to provision an account.",
            )
        validate_password_policy(req.password)
        client_ip = request.client.host if request.client else "unknown"

        # Rate limit: 3 registrations per 15 min per IP
        limited, wait = rate_limiter.is_rate_limited(client_ip, "register")
        if limited:
            raise HTTPException(
                status_code=429,
                detail=f"Too many registration attempts. Try again in {wait} seconds.",
                headers={"Retry-After": str(wait)},
            )
        existing = get_user_by_email(db, req.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        if req.role not in ROLE_permissions:
            raise HTTPException(status_code=400, detail="Invalid role")

        user_count = db.query(User).count()
        user_id = f"{req.role[:3].upper()}-{user_count + 1:03d}"
        user = User(
            id=user_id, name=req.name, email=req.email,
            hashed_password=pwd_context.hash(req.password),
            role=req.role, badge=f"BLD-2026-{user_count + 1:04d}",
            department=req.department,
            is_approved=False,
        )
        db.add(user)
        db.commit()

        return TokenResponse(
            access_token="",
            refresh_token="",
            expires_in=0,
            user={"id": user_id, "name": req.name, "email": req.email, "role": req.role, "badge": user.badge, "department": req.department, "pending_approval": True}
        )

    @app.post("/api/auth/refresh", response_model=TokenResponse)
    def refresh_token(request: Request, response: Response, req: RefreshRequest, db: Session = Depends(get_db)):
        client_ip = request.client.host if request.client else "unknown"

        # Rate limit: 10 refreshes per 15 min per IP
        limited, wait = rate_limiter.is_rate_limited(client_ip, "refresh")
        if limited:
            raise HTTPException(
                status_code=429,
                detail=f"Too many refresh attempts. Try again in {wait} seconds.",
                headers={"Retry-After": str(wait)},
            )
        # Body token first (API clients/tests); HttpOnly cookie is the browser path.
        refresh_token_value = req.refresh_token or request.cookies.get("atlas_refresh", "")
        if not refresh_token_value:
            raise HTTPException(status_code=401, detail="Missing refresh token")
        payload = decode_refresh_token(refresh_token_value)
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        user = get_user_by_email(db, email)
        if user is None or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        # Check if refresh token exists and is not revoked
        db_token = db.query(RefreshToken).filter(
            RefreshToken.token == refresh_token_value,
            RefreshToken.revoked == False,
        ).first()

        if not db_token:
            raise HTTPException(status_code=401, detail="Refresh token not found or revoked")

        # Revoke old token (rotation)
        db_token.revoked = True

        # Create new tokens
        new_access = create_access_token({"sub": user.email, "role": user.role})
        new_refresh = create_refresh_token({"sub": user.email, "role": user.role})

        db_token.replaced_by = new_refresh

        new_db_token = RefreshToken(
            token=new_refresh, user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(new_db_token)
        db.commit()

        response.set_cookie(
            "atlas_refresh",
            new_refresh,
            max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
            httponly=True,
            secure=os.getenv("COOKIE_SECURE", "false").lower() in ("true", "1", "yes"),
            samesite="strict",
            path="/api/auth",
        )

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user={
                "id": user.id, "name": user.name, "email": user.email,
                "role": user.role, "badge": user.badge,
                "department": getattr(user, "department", ""),
            }
        )

    @app.post("/api/auth/logout")
    def logout(request: Request, response: Response, req: RefreshRequest, user: dict = Depends(verify_token), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
        token_value = req.refresh_token or request.cookies.get("atlas_refresh", "")
        db_token = db.query(RefreshToken).filter(RefreshToken.token == token_value).first() if token_value else None
        if db_token:
            db_token.revoked = True
            db.commit()
        response.delete_cookie("atlas_refresh", path="/api/auth")
        return {"status": "logged_out"}

    @app.get("/api/auth/me")
    def get_me(user: dict = Depends(verify_token)):
        return UserProfile(
            id=user["id"], name=user["name"], email=user["email"],
            role=user["role"], badge=user["badge"],
            department=user.get("department", ""),
            permissions=user["permissions"],
            created_at=user.get("created_at"),
            last_login=user.get("last_login"),
        )

    @app.put("/api/auth/me")
    def update_me(req: UpdateProfileRequest, user: dict = Depends(verify_token), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
        db_user = db.query(User).filter(User.email == user["email"]).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        if req.name is not None:
            db_user.name = req.name
        if req.badge is not None:
            db_user.badge = req.badge
        if req.department is not None:
            db_user.department = req.department
        db.commit()
        return {"status": "updated", "user": {
            "id": db_user.id, "name": db_user.name, "email": db_user.email,
            "role": db_user.role, "badge": db_user.badge,
            "department": getattr(db_user, "department", ""),
        }}

    @app.post("/api/auth/change-password")
    def change_password(req: ChangePasswordRequest, user: dict = Depends(verify_token), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
        db_user = db.query(User).filter(User.email == user["email"]).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        if not pwd_context.verify(req.current_password, db_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        validate_password_policy(req.new_password)
        db_user.hashed_password = pwd_context.hash(req.new_password)
        db.commit()
        return {"status": "password_changed"}

    @app.get("/api/auth/users")
    def list_users(user: dict = Depends(require_role("admin", "inspector")), db: Session = Depends(get_db)):
        users = db.query(User).all()
        return [
            {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
             "badge": u.badge, "is_active": u.is_active, "is_approved": u.is_approved,
             "last_login": u.last_login.isoformat() if u.last_login else None}
            for u in users
        ]

    @app.post("/api/auth/approve/{user_id}")
    def approve_user(user_id: str, user: dict = Depends(require_role("admin")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        target.is_approved = True
        db.commit()
        return {"status": "approved", "user_id": user_id}

    @app.post("/api/auth/reject/{user_id}")
    def reject_user(user_id: str, user: dict = Depends(require_role("admin")), csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        target.is_approved = False
        target.is_active = False
        db.commit()
        return {"status": "rejected", "user_id": user_id}

    @app.get("/api/auth/demo-credentials")
    def demo_credentials():
        """Demo-mode-only: quick-login credentials for the judge demo portal.

        Kept server-side (not in the JS bundle) and 404s outside DEMO_MODE so
        production builds ship no embedded credentials. Emails are public
        demo identities; passwords are only disclosed while DEMO_MODE is on.
        """
        if not DEMO_MODE:
            raise HTTPException(status_code=404, detail="Not found")
        return [
            {"label": u["role"].replace("_", " ").title(), "email": u["email"],
             "password": u["password"]}
            for u in DEMO_USER_SEEDS
        ]

    @app.get("/api/auth/ws-ticket")
    def get_ws_ticket(user: dict = Depends(verify_token)):
        """Get a short-lived (30s) single-use ticket for WebSocket connection.
        Use this ticket instead of passing JWT in the WebSocket URL."""
        user_info = {
            "id": user["id"], "name": user["name"], "email": user["email"],
            "role": user["role"], "badge": user.get("badge", ""),
            "department": user.get("department", ""),
            "permissions": user.get("permissions", ["read"]),
        }
        ticket = generate_ws_ticket(user_info)
        return {"ticket": ticket, "expires_in": 30}

    @app.get("/api/auth/tokens")
    def list_tokens(user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
        tokens = db.query(RefreshToken).order_by(RefreshToken.created_at.desc()).limit(50).all()
        return [
            {"id": t.id, "user_id": t.user_id, "created_at": t.created_at.isoformat(),
             "expires_at": t.expires_at.isoformat(), "revoked": t.revoked,
             "replaced_by": t.replaced_by}
            for t in tokens
        ]
