METRIPORT_WEBHOOK_URL = "https://api.metriport.com/ehr/webhook/canvas"
METRIPORT_DASH_URL = "https://ehr.metriport.com/canvas/app"

def get_metriport_token(secrets: dict, isWebhook: bool = False) -> str:
    metriport_token: str | None = None
    if (isWebhook):
        metriport_token = secrets['METRIPORT_WEBHOOK_TOKEN']
    else:
        metriport_token = secrets['METRIPORT_TOKEN']
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
