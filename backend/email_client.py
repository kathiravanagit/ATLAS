import os
import smtplib
from email.message import EmailMessage
import logging

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
ALERT_FROM_EMAIL = os.getenv("ALERT_FROM_EMAIL", "alerts@atlas.gov")
INVESTIGATOR_EMAIL = os.getenv("INVESTIGATOR_EMAIL", "investigator@atlas.gov")

def send_email_alert(subject: str, message: str, to_email: str = None):
    """
    Sends an email alert using standard SMTP.
    Gracefully skips if SMTP credentials are not configured.
    """
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP credentials missing. Skipping email alert.")
        return False
        
    try:
        msg = EmailMessage()
        msg.set_content(message)
        msg['Subject'] = f"[ATLAS ALERT] {subject}"
        msg['From'] = ALERT_FROM_EMAIL
        msg['To'] = to_email if to_email else INVESTIGATOR_EMAIL
        
        # Connect to SMTP server (TLS)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Email alert sent successfully to {msg['To']}!")
        return True
    except Exception as e:
        logger.error(f"Failed to send email alert: {str(e)}")
        return False
