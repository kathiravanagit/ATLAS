#!/usr/bin/env python3
"""Local signed-channel listener for the rough/desktop take. Not a feature.

Binds a real HTTP listener, recomputes HMAC over the exact wire bytes with
`webhook_client.verify_signature` (the same function the wire-probe test uses),
and prints:
  signature OK + event: alert.blocked + tokenised account
or FAILED with the reason. Run it next to the browser:

  $env:ALERT_WEBHOOK_SECRET = "<same secret the API signs with>"
  python backend/bank_listener.py           # binds 127.0.0.1:8099
  $env:ALERT_WEBHOOK_URL = "http://127.0.0.1:8099/atlas/alert"   # on the API

Env: ALERT_WEBHOOK_SECRET (required), BANK_LISTENER_PORT (default 8099),
BANK_LISTENER_PATH (default /atlas/alert).
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

import webhook_client

SECRET = (os.getenv("ALERT_WEBHOOK_SECRET") or "").strip()
PORT = int(os.getenv("BANK_LISTENER_PORT") or "8099")
PATH = os.getenv("BANK_LISTENER_PATH") or "/atlas/alert"


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        ts = self.headers.get("X-ATLAS-Timestamp") or ""
        sig = self.headers.get("X-ATLAS-Signature") or ""
        event = self.headers.get("X-ATLAS-Event") or ""
        ok = webhook_client.verify_signature(SECRET, ts, body, sig)
        try:
            parsed = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            parsed = {}
        account = ""
        if isinstance(parsed, dict):
            account = (parsed.get("block_request") or {}).get("to_account", "")
            event = parsed.get("event", event) or event
        if ok:
            print(f"signature OK | event: {event} | account: {account}", flush=True)
            reply = 202
        else:
            print(f"signature FAILED | event: {event} | account: {account or '(unknown)'} | reason: signature does not match body or timestamp is stale", flush=True)
            reply = 500
        payload = b"{}"
        self.send_response(reply)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main() -> int:
    if not SECRET:
        sys.stderr.write("ALERT_WEBHOOK_SECRET is required.\n")
        return 2
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"bank listener on http://127.0.0.1:{PORT}{PATH} — point ALERT_WEBHOOK_URL here", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
