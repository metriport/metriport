from canvas_sdk.events import EventType
from canvas_sdk.protocols import BaseProtocol
from canvas_sdk.utils import Http
from requests import Response
from datetime import datetime, timezone, timedelta
from canvas_sdk.v1.data.patient import Patient
from logger import log

METRIPORT_WEBHOOK_URL = "https://api.metriport.com/ehr/webhook/canvas"
METRIPORT_WEBHOOK_NAME = "patient-created"
METRIPORT_TOKEN_SECRET = "METRIPORT_WEBHOOK_TOKEN"


# We use PATIENT_ADDRESS_CREATED and PATIENT_ADDRESS_UPDATED events as proxies for PATIENT_CREATED
# because Canvas doesn't collect enough information to trigger the PATIENT_CREATED event.
# When a patient is created through the UI or API, an address is typically added shortly after,
# which triggers these address events. By listening for these events and checking if the patient
# was recently created (within the last day), we can effectively capture new patient creation
# and ensure we don't miss any patients that should be synchronized with Metriport.
class PatientAddressCreatedProtocol(BaseProtocol):
    """Handle when an address is added for a patient."""
    
    RESPONDS_TO = EventType.Name(EventType.PATIENT_ADDRESS_CREATED)
    
    def compute(self):
        metriport_token = validate_metriport_token(self)
        patient_id = self.context['patient']['id']
        patient = Patient.objects.get(id=patient_id)
        time_since_created = datetime.now(timezone.utc) - patient.created
        is_new_patient = time_since_created <= timedelta(days=1)

        if is_new_patient:
            handle_patient_created(patient_id, metriport_token)
        else:
            log.info(f"⚠️ Skipping - not a new patient (created {time_since_created} ago)")
        
        return []


class PatientAddressUpdatedProtocol(BaseProtocol):
    """Handle when a patient's address is updated."""
    
    RESPONDS_TO = EventType.Name(EventType.PATIENT_ADDRESS_UPDATED)
    
    def compute(self):
        metriport_token = validate_metriport_token(self)
        patient_id = self.context['patient']['id']
        patient = Patient.objects.get(id=patient_id)
        time_since_created = datetime.now(timezone.utc) - patient.created
        is_new_patient = time_since_created <= timedelta(days=1)
        
        if is_new_patient:
            handle_patient_created(patient_id, metriport_token)
        else:
            log.info(f"⚠️ Skipping - not a new patient (created {time_since_created} ago)")
        
        return []


def validate_metriport_token(self):
    metriport_token = self.secrets[METRIPORT_TOKEN_SECRET]
    if metriport_token is None:
        raise Exception("Metriport token not set")
    if metriport_token == "":
        raise Exception("Metriport token is empty")
    return metriport_token

def handle_patient_created(patient_id: str, metriport_token: str):
    url = f"{METRIPORT_WEBHOOK_URL}/patient/{patient_id}/{METRIPORT_WEBHOOK_NAME}"
    payload = create_webhook_payload(METRIPORT_WEBHOOK_NAME, patient_id)
    headers = create_webhook_headers(metriport_token)
    make_webhook_request(url, payload, headers)

def create_webhook_payload(wh_type: str, patient_id: str) -> dict:
    return {
        "meta": {
            "type": wh_type,
        },
        "patientId": patient_id,
    }

def create_webhook_headers(metriport_token: str) -> dict:
    return {
        "authorization": f"Bearer {metriport_token}",
    }

def make_webhook_request(url: str, payload: dict, headers: dict) -> Response:
    http = Http()
    response = http.post(url, json=payload, headers=headers)
    if response.ok:
        log.info("Webhook request successful")
        return response
    log.error(f"Webhook request failed: {response}")
    raise Exception(f"Webhook request failed: {response}")

