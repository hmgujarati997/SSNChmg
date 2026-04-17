"""WhatsApp messaging service using flexiwaba API."""
import httpx
import logging
import os
import re
from database import db

logger = logging.getLogger(__name__)

WHATSAPP_API_URL = "https://backend.api-wa.co/campaign/flexiwaba/api"


def normalize_phone(phone: str) -> str:
    """Ensure phone has 91 country code. Returns digits only with 91 prefix."""
    digits = re.sub(r'\D', '', phone)
    if digits.startswith('+'):
        digits = digits[1:]
    if digits.startswith('91') and len(digits) >= 12:
        return digits
    if len(digits) == 10:
        return f"91{digits}"
    return digits


async def get_wa_config():
    """Get WhatsApp config from site_settings."""
    settings = await db.site_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return None
    api_key = settings.get("wa_api_key", "")
    username = settings.get("wa_username", "")
    source = settings.get("wa_source", "")
    if not api_key or not username or not source:
        return None
    return {
        "api_key": api_key,
        "username": username,
        "source": source,
    }


async def send_whatsapp(destination: str, template_name: str, template_params: list, campaign_name: str = "ssnc", attributes: dict = None, media_url: str = None):
    """Send a WhatsApp message via flexiwaba API. Returns (success, response_text)."""
    # TEST MODE: simulate delivery without making real API calls.
    # Set WA_TEST_MODE=1 in backend/.env during load testing to prevent real sends.
    if os.environ.get("WA_TEST_MODE") == "1":
        phone = normalize_phone(destination)
        logger.info(f"[WA_TEST_MODE] Simulated send to {phone}: template={template_name}, params={template_params}")
        return True, "TEST_MODE_SIMULATED_OK"

    config = await get_wa_config()
    if not config:
        return False, "WhatsApp not configured. Set API key, username, and source in Settings."

    phone = normalize_phone(destination)
    payload = {
        "apiKey": config["api_key"],
        "destination": phone,
        "campaignName": campaign_name,
        "userName": config["username"],
        "source": config["source"],
        "template": {
            "name": template_name,
            "language": "en"
        },
        "templateParams": template_params,
    }
    if attributes:
        payload["attributes"] = attributes
    if media_url:
        payload["media"] = {"url": media_url, "filename": "qr_code.png"}

    logger.info(f"WA payload to {phone}: template={template_name}, campaign={campaign_name}, params={template_params}, media={media_url or 'none'}")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(WHATSAPP_API_URL, json=payload)
            if resp.status_code == 200:
                logger.info(f"WA success for {phone}: {resp.text[:200]}")
                return True, resp.text
            else:
                logger.error(f"WhatsApp API error {resp.status_code}: {resp.text}")
                return False, f"API error {resp.status_code}: {resp.text}"
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")
        return False, str(e)
