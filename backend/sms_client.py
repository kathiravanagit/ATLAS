"""Outbound SMS via Fast2SMS (same send_sms_alert contract throughout).

Production SMS in India requires DLT registration for headers/templates;
the default quick route is for testing only.

Messages are sanitized to GSM-7 (Rs. instead of rupee sign, ASCII dashes)
so trial-route gateways accept them as single-segment SMS.
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

PROVIDER = os.getenv("SMS_PROVIDER", "fast2sms").strip().lower()
INVESTIGATOR_PHONE_NUMBER = os.getenv("INVESTIGATOR_PHONE_NUMBER", "")

FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")
FAST2SMS_SENDER_ID = os.getenv("FAST2SMS_SENDER_ID", "FSTSMS")
FAST2SMS_ROUTE = os.getenv("FAST2SMS_ROUTE", "q")
FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"

_GSM_REPLACEMENTS = {
    "\u20b9": "Rs.",  # rupee sign
    "\u2014": "-", "\u2013": "-",  # em/en dashes
    "\u2018": "'", "\u2019": "'",
    "\u201c": '"', "\u201d": '"',
}


def sanitize_gsm(message: str) -> str:
    """Replace non-GSM-7 characters so trial routes accept the SMS."""
    for src, dst in _GSM_REPLACEMENTS.items():
        message = message.replace(src, dst)
    return message.encode("ascii", errors="replace").decode("ascii")


def _send_fast2sms(message: str, to_number: str):
    if not FAST2SMS_API_KEY:
        logger.warning("FAST2SMS_API_KEY missing. Skipping SMS alert.")
        return False
    if not to_number:
        logger.warning("No recipient number (INVESTIGATOR_PHONE_NUMBER). Skipping SMS alert.")
        return False
    numbers = to_number.strip().lstrip("+").replace(" ", "")
    try:
        resp = httpx.post(
            FAST2SMS_URL,
            headers={"authorization": FAST2SMS_API_KEY},
            data={
                "sender_id": FAST2SMS_SENDER_ID,
                "message": sanitize_gsm(message),
                "route": FAST2SMS_ROUTE,
                "numbers": numbers,
            },
            timeout=15,
        )
        data = resp.json()
        if data.get("return") is True:
            logger.info("Fast2SMS alert sent (request_id=%s)", data.get("request_id"))
            return True
        logger.error("Fast2SMS rejected SMS: %s", str(data)[:200])
        return False
    except Exception as e:
        logger.error(f"Failed to send Fast2SMS alert: {str(e)}")
        return False


def send_sms_alert(message: str, to_number: str = None):
    """Send an SMS via Fast2SMS. Never raises."""
    if PROVIDER != "fast2sms":
        logger.warning("Unknown SMS_PROVIDER=%r; want fast2sms. Skipping SMS alert.", PROVIDER)
        return False
    target = to_number or INVESTIGATOR_PHONE_NUMBER
    return _send_fast2sms(message, target)
