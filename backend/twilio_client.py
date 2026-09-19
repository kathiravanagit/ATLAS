import os
from twilio.rest import Client
import logging

logger = logging.getLogger(__name__)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")
INVESTIGATOR_PHONE_NUMBER = os.getenv("INVESTIGATOR_PHONE_NUMBER", "")

def send_sms_alert(message: str, to_number: str = None):
    """
    Sends an SMS alert using Twilio.
    """
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials missing. Skipping SMS alert.")
        return False
        
    try:
        # If API key is provided instead of Account SID, it still works if we pass it correctly
        # Twilio client accepts API Key as username and API Secret as password
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        target_number = to_number if to_number else INVESTIGATOR_PHONE_NUMBER
        
        message = client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=target_number
        )
        logger.info(f"SMS Alert sent successfully! SID: {message.sid}")
        return True
    except Exception as e:
        logger.error(f"Failed to send Twilio SMS: {str(e)}")
        return False
