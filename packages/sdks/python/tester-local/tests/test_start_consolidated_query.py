import os
import time
from dotenv import load_dotenv
import json
from generated.client import Metriport

load_dotenv()

api_key = os.environ.get("API_KEY")
patient_id = os.environ.get("PATIENT_ID")
base_url = os.environ.get("BASE_URL")

def test_start_consolidated_query():
    client = Metriport(api_key=api_key, base_url=base_url)

    print("Calling get_consolidated_query_status...")
    query_status = client.medical.fhir.get_consolidated_query_status(id=patient_id)
    print(f"queryStatus: {query_status}")

    print("Calling start_consolidated_query...")
    response = client.medical.fhir.start_consolidated_query(
        id=patient_id,
        resources="DocumentReference,Appointment",
        date_from="2021-03-01",
        date_to="2023-04-23"
    )
    print(f"response: {json.dumps(response.dict(), indent=2)}")

    print("Now, calling get_consolidated_query_status...")
    query_status = client.medical.fhir.get_consolidated_query_status(id=patient_id)
    print(f"queryStatus: {json.dumps(query_status.dict(), indent=2)}")

    print("Sleeping...")
    time.sleep(5)

    print("Calling get_consolidated_query_status again...")
    query_status = client.medical.fhir.get_consolidated_query_status(id=patient_id)
    print(f"queryStatus: {json.dumps(query_status.dict(), indent=2)}")

    print("Counting...")
    count = client.medical.fhir.count_patient_data(
        id=patient_id,
    )
    print(f"count: {json.dumps(count.dict(), indent=2)}")


