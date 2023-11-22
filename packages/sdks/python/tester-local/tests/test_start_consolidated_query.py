import os
import time
from dotenv import load_dotenv
import json
from generated.client import Metriport

load_dotenv()

def get_env_var_or_fail(key):
    value = os.getenv(key)
    if value is None:
        raise Exception(f"{key} not found")
    return value

def test_start_consolidated_query():
    base_url = get_env_var_or_fail("BASE_URL")
    api_key = get_env_var_or_fail("METRIPORT_API_KEY")
    patient_id = get_env_var_or_fail("PATIENT_ID")

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

if __name__ == "__main__":
    main()