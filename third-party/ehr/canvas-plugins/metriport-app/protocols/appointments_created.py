from canvas_sdk.events import EventType
from canvas_sdk.protocols import BaseProtocol
from canvas_sdk.utils import Http
from requests import Response
from logger import log

METRIPORT_WEBHOOK_URL = "https://844e3f1e501a.ngrok.app/ehr/webhook/canvas"
METRIPORT_WEBHOOK_NAME = 'appointment-created'
METRIPORT_TOKEN_SECRET = "METRIPORT_WEBHOOK_TOKEN"

class AppointmentCreatedProtocol(BaseProtocol):
    """A protocol that sends a webhook to the Metriport API when an appointment is created."""

    RESPONDS_TO = EventType.Name(EventType.APPOINTMENT_CREATED)

    def compute(self):
        """Send a request to the Metriport API when an appointment is created to create a patient."""
        metriport_token = self.secrets[METRIPORT_TOKEN_SECRET]
        if (metriport_token is None):
          raise Exception("Metriport token not set")
        if (metriport_token == ""):
          raise Exception("Metriport token is empty")
        patient_id = self.context['patient']['id']

        url = f"{METRIPORT_WEBHOOK_URL}/patient/{patient_id}/{METRIPORT_WEBHOOK_NAME}"
        payload = create_webhook_payload(METRIPORT_WEBHOOK_NAME, patient_id)
        headers = create_webhook_headers(metriport_token)
        make_webhok_request(url, payload, headers)
        return []

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
