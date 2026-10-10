"""Outbound SMS via TextBee device gateway (same send_sms_alert contract throughout).

Prototype demo channel only — not a government SMS system. India
production SMS would require DLT registration plus an approved gateway
where applicable.

Messages are sanitized to GSM-7 (Rs. instead of rupee sign, ASCII dashes)
so gateway routes accept them as single-segment SMS.
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

PROVIDER = os.getenv("SMS_PROVIDER", "textbee").strip().lower()
INVESTIGATOR_PHONE_NUMBER = os.getenv("INVESTIGATOR_PHONE_NUMBER", "")

TEXTBEE_API_KEY = os.getenv("TEXTBEE_API_KEY", "")
TEXTBEE_DEVICE_ID = os.getenv("TEXTBEE_DEVICE_ID", "")
TEXTBEE_URL = "https://api.textbee.dev/api/v1/gateway/send-sms"

_GSM_REPLACEMENTS = {
    "\u20b9": "Rs.",  # rupee sign
    "\u2014": "-", "\u2013": "-",  # em/en dashes
    "\u2018": "'", "\u2019": "'",
    "\u201c": '"', "\u201d": '"',
}


def sanitize_gsm(message: str) -> str:
    """Replace non-GSM-7 characters so gateway routes accept the SMS."""
    for src, dst in _GSM_REPLACEMENTS.items():
        message = message.replace(src, dst)
    return message.encode("ascii", errors="replace").decode("ascii")


def _send_textbee(message: str, to_number: str):
    if not TEXTBEE_API_KEY:
        logger.warning("TEXTBEE_API_KEY missing. Skipping SMS alert.")
        return False
    if not TEXTBEE_DEVICE_ID:
        logger.warning("TEXTBEE_DEVICE_ID missing. Skipping SMS alert.")
        return False
    if not to_number:
        logger.warning("No recipient number (INVESTIGATOR_PHONE_NUMBER). Skipping SMS alert.")
        return False
    recipient = to_number.strip().replace(" ", "")
    if not recipient.startswith("+"):
        recipient = "+" + recipient
    try:
        resp = httpx.post(
            TEXTBEE_URL,
            headers={"x-api-key": TEXTBEE_API_KEY},
            json={
                "deviceId": TEXTBEE_DEVICE_ID,
                "recipients": [recipient],
                "message": sanitize_gsm(message),
            },
            timeout=15,
        )
        if 200 <= resp.status_code < 300:
            logger.info("TextBee alert sent to %s", recipient)
            return True
        logger.error("TextBee rejected SMS (status=%s): %s", resp.status_code, str(resp.text)[:200])
        return False
    except Exception as e:
        logger.error(f"Failed to send TextBee alert: {str(e)}")
        return False


def send_sms_alert(message: str, to_number: str = None):
    """Send an SMS via TextBee. Never raises."""
    if PROVIDER != "textbee":
        logger.warning("Unknown SMS_PROVIDER=%r; want textbee. Skipping SMS alert.", PROVIDER)
        return False
    target = to_number or INVESTIGATOR_PHONE_NUMBER
    return _send_textbee(message, target)
