import requests

def get_patient_ids(api_url: str, cx_id: str) -> list[str]:
    response = requests.get(f"{api_url}/internal/patient/ids?cxId={cx_id}")
    if response.status_code != 200:
        raise Exception(f"Failed to get patient ids from {api_url}: {response.status_code} {response.text}")
    if "patientIds" not in response.json():
        raise Exception(f"Failed to parse patient ids from {api_url}: {response.status_code} {response.text}")
    return response.json()["patientIds"]
