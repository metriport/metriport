import requests

def get_patient_ids(api_url: str, cx_id: str) -> list[str]:
    response = requests.get(f"{api_url}/internal/patient/ids?cxId={cx_id}")
    return response.json()["patientIds"]
