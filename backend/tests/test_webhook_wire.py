"""Webhook wire probe: a real HTTP listener, real bytes, verifies end to end.

`tests/test_signed_webhook.py` proves the `timestamp.body` / no-fallback
contract in-process. That cannot see a header dropped by a proxy, a body
re-encoded on the wire, or a receiver that never asked for JSON. This module
closes that gap: a real ThreadingHTTPServer on an ephemeral localhost port
receives the delivery over real TCP / HTTP/1.1, and the receiver-side
`verify_signature` is checked against the exact wire bytes.

Everything here uses the same `webhook_client.send_webhook` the worker calls.
"""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import webhook_client

SECRET = "webhook-wire-test-secret-at-least-32-chars"
URL_HOST = "127.0.0.1"


class _Capture:
    requests: list = []
    fail_next = False


class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        _Capture.requests.append(
            {"method": self.command, "path": self.path,
             "headers": dict(self.headers.items()), "body": body})
        reply = 500 if _Capture.fail_next else 202
        _Capture.fail_next = False
        self.send_response(reply)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"{}")


def _serve():
    server = ThreadingHTTPServer((URL_HOST, 0), _Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, f"http://{URL_HOST}:{port}/hooks/atlas"


def test_wire_delivery_verifies_at_the_receiver():
    server, url = _serve()
    _Capture.requests = []
    _Capture.fail_next = False
    envelope = {
        "event": "alert.created",
        "alert": {"alert_id": "ALT-WIRE-1", "case_id": "CASE-001",
                  "message": "probe", "risk_level": "High",
                  "location": "PNY-001", "district": "Puducherry",
                  "time_window": "18:00-20:00", "timestamp": "10:00:00",
                  "acknowledged": False},
    }
    try:
        assert webhook_client.send_webhook(envelope, url=url, secret=SECRET) is True
    finally:
        server.shutdown()

    requests = _Capture.requests
    assert len(requests) == 1, f"expected exactly one wire request, got {len(requests)}"
    req = requests[0]
    headers = req["headers"]
    # http.server presents header names as sent.
    ts = headers.get("X-ATLAS-Timestamp") or headers.get("x-atlas-timestamp")
    sig = headers.get("X-ATLAS-Signature") or headers.get("x-atlas-signature")
    event = headers.get("X-ATLAS-Event") or headers.get("x-atlas-event")

    assert req["method"] == "POST"
    assert req["path"] == "/hooks/atlas"
    assert (headers.get("Content-Type") or "").startswith("application/json")
    assert event == "alert.created"
    assert ts and sig
    assert abs(time.time() - int(ts)) <= 5, "timestamp is not fresh"
    # The whole point: receiver can verify the exact wire bytes.
    assert webhook_client.verify_signature(SECRET, ts, req["body"], sig)
    assert json.loads(req["body"]) == envelope


def test_wire_non_2xx_is_a_failed_attempt_not_an_exception():
    server, url = _serve()
    _Capture.requests = []
    _Capture.fail_next = True
    try:
        assert webhook_client.send_webhook({"event": "alert.blocked"}, url=url, secret=SECRET) is False
    finally:
        server.shutdown()
    assert len(_Capture.requests) == 1
    # And a following delivery can still succeed.
    server, url = _serve()
    _Capture.requests = []
    try:
        assert webhook_client.send_webhook({"event": "alert.blocked"}, url=url, secret=SECRET) is True
    finally:
        server.shutdown()
    assert len(_Capture.requests) == 1
