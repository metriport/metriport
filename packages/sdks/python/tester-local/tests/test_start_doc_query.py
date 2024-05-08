import os

from generated.client import Metriport
from generated import commons
from generated.resources import medical

import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("API_KEY")
patient_id = os.environ.get("PATIENT_ID")
facility_id = os.environ.get("FACILITY_ID")
base_url = os.environ.get("BASE_URL")


def test_start_doc_query() -> None:
    client = Metriport(api_key=api_key, base_url=base_url)
    response = client.medical.document.start_query(patient_id=patient_id, facility_id=facility_id)
    print(f"Response: {response}")
