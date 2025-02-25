from canvas_sdk.events import EventType
from canvas_sdk.protocols import BaseProtocol

from shared import (
  METRIPORT_WEBHOOK_URL,
  get_metriport_token,
  get_patient_id,
  create_webhook_payload,
  create_webhook_headers,
  make_webhok_request
)

class AppointmentCreatedProtocol(BaseProtocol):
    """A protocol that sends a webhook to the Metriport API when an appointment is created."""

    EVENT_TYPE = EventType.APPOINTMENT_CREATED
    RESPONDS_TO = EventType.Name(EVENT_TYPE)

    def compute(self):
        """Send a request to the Metriport API when an appointment is created to create a patient."""
        metriport_token = get_metriport_token(self.secrets)
        patient_id = get_patient_id(self.context)

        url = f"{METRIPORT_WEBHOOK_URL}/appointment-created"
        payload = create_webhook_payload(self.EVENT_TYPE, patient_id)
        headers = create_webhook_headers(metriport_token)
        make_webhok_request(payload, headers)

        return []
