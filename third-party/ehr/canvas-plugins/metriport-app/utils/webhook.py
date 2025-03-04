from canvas_sdk.utils import Http
from requests import Response
from logger import log

def create_webhook_payload(wh_type: str, patient_id: str) -> dict:
    return {
        "meta": {
            "type": wh_type,
        },
        "patientId": patient_id,
    }

def create_webhook_headers(metriport_token: str) -> dict:
    return {
        "Authorization": f"Bearer {metriport_token}",
    }

def make_webhok_request(url: str, payload: dict, headers: dict) -> Response:
    http = Http()
    response = http.post(url, json=payload, headers=headers)
    if (response.ok):
        log.info("Webhook request successful")
        return response
    log.error(f"Webhook request failed: {response}")
    raise Exception(f"Webhook request failed: {response}")
