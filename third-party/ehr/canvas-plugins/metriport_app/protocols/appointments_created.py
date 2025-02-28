from canvas_sdk.events import EventType
from canvas_sdk.protocols import BaseProtocol

from metriport_app.utils.shared import (
  METRIPORT_WEBHOOK_URL,
  get_metriport_token,
  get_patient_id,
)
from metriport_app.utils.webhook import (
  create_webhook_payload,
  create_webhook_headers,
  make_webhok_request
)

METRIPORT_WH_NAME = 'appointment-created'

class AppointmentCreatedProtocol(BaseProtocol):
    """A protocol that sends a webhook to the Metriport API when an appointment is created."""

    RESPONDS_TO = EventType.Name(EventType.APPOINTMENT_CREATED)

    def compute(self):
        """Send a request to the Metriport API when an appointment is created to create a patient."""

        metriport_token = get_metriport_token(self.secrets, True)
        patient_id = get_patient_id(self.context)

        url = f"{METRIPORT_WEBHOOK_URL}/patient/{patient_id}/{METRIPORT_WH_NAME}"
        payload = create_webhook_payload(METRIPORT_WH_NAME, patient_id)
        headers = create_webhook_headers(metriport_token)
        make_webhok_request(url, payload, headers)

        return []
