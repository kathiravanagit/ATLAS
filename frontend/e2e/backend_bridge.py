"""Real FastAPI TestClient transport for frontend investigation E2E.

All mutable runtime files live beneath frontend/test-results in a temporary
working directory. Model artifacts are read only; no project DB or ledger is
opened. No API handlers, estimators, or explanation outputs are mocked.
"""

import json
import os
from pathlib import Path
import shutil
import socket
import sys
import tempfile

FRONTEND = Path(__file__).resolve().parents[1]
BACKEND = FRONTEND.parent / "backend"
OUTPUT = sys.stdout
sys.stdout = sys.stderr  # Application diagnostics must not corrupt JSON RPC.
sys.dont_write_bytecode = True


def emit(value):
    OUTPUT.write(json.dumps(value) + "\n")
    OUTPUT.flush()


def forbid_external_network(*args, **kwargs):
    raise RuntimeError("External connections and notification senders are disabled in isolated frontend E2E")


def local_event_loop_only(original):
    def connect(sock, address):
        # Windows asyncio's socketpair implementation needs a local loopback
        # connection. No external provider or non-loopback socket is allowed.
        if isinstance(address, tuple) and address[0] in ("127.0.0.1", "::1"):
            return original(sock, address)
        raise RuntimeError(f"External socket blocked in isolated E2E: {address!r}")
    return connect


def run():
    (FRONTEND / "test-results").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="real-backend-", dir=FRONTEND / "test-results") as directory:
        runtime = Path(directory)
        os.chdir(runtime)
        os.environ.update({
            "TESTING": "1", "DEMO_MODE": "false", "REGISTRATION_ENABLED": "false",
            "DATABASE_URL": "sqlite:///" + (runtime / "investigation.db").as_posix(),
            "JWT_SECRET_KEY": "", "SECRET_KEY": "frontend-isolated-test-access-secret-at-least-32-chars",
            "REFRESH_SECRET_KEY": "frontend-isolated-test-refresh-secret-at-least-32-chars",
            "ENCRYPTION_KEY": bytes(range(32)).hex(), "COOKIE_SECURE": "false", "CHAIN_BACKEND": "file",
            "SMS_PROVIDER": "textbee", "TEXTBEE_API_KEY": "", "TEXTBEE_DEVICE_ID": "",
            "SMTP_HOST": "", "SMTP_USER": "", "SMTP_PASSWORD": "",
        })
        sys.path.insert(0, str(BACKEND))
        (runtime / "model").mkdir()
        for name in ("dataset_stats.json", "validation_report.json"):
            source = BACKEND / "model" / name
            if source.is_file():
                shutil.copyfile(source, runtime / "model" / name)
        socket.socket.connect = local_event_loop_only(socket.socket.connect)
        socket.socket.connect_ex = local_event_loop_only(socket.socket.connect_ex)
        from fastapi.testclient import TestClient
        import auth
        import database
        import main
        from models_db import User, Case, AtmLocation, Alert, AuditLog, NotificationJob, TransactionRecord
        main.send_sms_alert = forbid_external_network
        main.send_email_alert = forbid_external_network
        database.Base.metadata.create_all(bind=database.engine)
        with database.SessionLocal() as db:
            db.add(User(id="E2E-ADMIN", name="Isolated Frontend Investigator", email="frontend-e2e@example.invalid",
                        hashed_password=auth.pwd_context.hash("isolated-e2e-password"), role="admin", is_active=True, is_approved=True))
            db.add(Case(case_id="CASE-INTEGRATION-001", crime_type="UPI Fraud", amount=450000,
                        linked_accounts=4, current_risk="High", status="investigating",
                        victim_name="Synthetic test subject", contact="Synthetic only", description="Puducherry synthetic investigation E2E"))
            for atm in main.CITIES["puducherry"]["atms"]:
                db.add(AtmLocation(atm_id=atm["id"], name=atm["name"], latitude=atm["lat"], longitude=atm["lng"], area="Puducherry"))
            db.commit()
            # Explicit seed alert exercises acknowledgement regardless of the real
            # model's threshold. Transactions may generate additional real alerts.
            db.add(Alert(alert_id="ALT-INTEGRATION-SEED", case_id="CASE-INTEGRATION-001", message="Synthetic seeded investigation alert",
                         risk_level="High", location="PNY-001", time_window="Synthetic fixture", timestamp="12:00:00", acknowledged=False))
            db.commit()
        trace = []
        try:
            with TestClient(main.app) as client:
                emit({"ready": True})
                for line in sys.stdin:
                    message = json.loads(line)
                    identifier = message["id"]
                    if message.get("operation") == "shutdown":
                        emit({"id": identifier, "closed": True})
                        break
                    if message.get("operation") == "verify":
                        with database.SessionLocal() as db:
                            case = db.query(Case).filter_by(case_id="CASE-INTEGRATION-001").one()
                            jobs = db.query(NotificationJob).all()
                            transactions = db.query(TransactionRecord).filter_by(case_id=case.case_id, source="synthetic-simulation").all()
                            alert = db.query(Alert).filter_by(alert_id="ALT-INTEGRATION-SEED").one()
                            emit({"id": identifier, "report": {"case_status": case.status, "acknowledged": alert.acknowledged,
                                "transactions": len(transactions), "transaction_amount": transactions[0].amount if transactions else None,
                                "audit_actions": [row.action for row in db.query(AuditLog).filter_by(case_id=case.case_id).all()],
                                "notification_states": [job.status for job in jobs], "trace": trace}})
                        continue
                    try:
                        response = client.request(message["method"], message["path"], headers=message.get("headers", {}), content=message.get("body"))
                        trace.append({"method": message["method"], "path": message["path"], "status": response.status_code})
                        headers = {key: value for key, value in response.headers.items() if key.lower() not in ("content-length", "content-encoding", "transfer-encoding")}
                        emit({"id": identifier, "status": response.status_code, "headers": headers, "body": response.text})
                    except Exception as exc:
                        emit({"id": identifier, "error": repr(exc)})
        finally:
            from sqlalchemy.orm import close_all_sessions
            close_all_sessions()
            database.engine.dispose()
            os.chdir(FRONTEND)


try:
    run()
except Exception as error:
    emit({"fatal": repr(error)})
    raise
