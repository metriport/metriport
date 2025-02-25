from canvas_sdk.events import EventType
from canvas_sdk.utils import Http
from logger import log

METRIPORT_WEBHOOK_URL = "https://api.metriport.com/ehr/webhook/canvas"
METRIPORT_DASH_URL = "https://ehr.metriport.com/canvas/app"

webhook_type_map = {
    EventType.APPOINTMENT_CREATED: "canvas.appointments.created",
}

def get_metriport_token(secrets: dict) -> str:
    metriport_token: str | None = secrets['METRIPORT_TOKEN']
    if (metriport_token is None):
      raise Exception("Metriport token not set")
    if (metriport_token == ""):
      raise Exception("Metriport token is empty")
    return metriport_token

def get_patient_id(context: dict) -> str:
    patient_id: str | None = context["patient"]["id"]
    if (patient_id is None):
      raise Exception("Patient ID not set")
    if (patient_id == ""):
      raise Exception("Patient ID is empty")
    return patient_id

def get_webhook_type(event_type: EventType) -> str:
    if (event_type not in webhook_type_map):
        raise Exception(f"Webhook type not found for event type: {event_type}")
    return webhook_type_map[event_type]

def create_webhook_payload(event_type: EventType, patient_id: str) -> dict:
    wh_type = get_webhook_type(event_type)
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

def make_webhok_request(url: str, payload: dict, headers: dict) -> Http.Response:
    http = Http()
    response = http.post(url, json=payload, headers=headers)
    if (response.ok):
        log.info("Webhook request successful")
        return response
    log.error(f"Webhook request failed: {response}")
    raise Exception(f"Webhook request failed: {response}")
