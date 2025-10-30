import os
from dotenv import load_dotenv
from generated.client import Metriport
from generated.medical import ConsolidatedBundleUpload

load_dotenv()

api_key = os.environ.get("API_KEY")
patient_id = os.environ.get("PATIENT_ID")
base_url = os.environ.get("BASE_URL")

def test_create_patient_consolidated():
    metriport = Metriport(api_key=api_key, base_url=base_url)

    query_status = metriport.medical.fhir.create_patient_consolidated(
        id=patient_id,
        resource_type="Bundle",
        type="collection",
        entry=[
            {
                "resource": {
                    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                    "resourceType": "Appointment",
                    "status": "booked",
                    "participant": [
                        {
                            "actor": {
                                "reference": f"Patient/{patient_id}",
                                "display": "John Doe",
                            },
                            "status": "accepted",
                            "period": {
                                "start": "2021-05-24T13:21:28.527Z",
                                "end": "2021-05-24T13:21:28.527Z",
                            },
                        }
                    ],
                    "meta": {
                        "versionId": "12345",
                        "lastUpdated": "2023-05-24T13:21:28.527Z",
                    },
                }
            }
        ]
    )
    print(f"queryStatus: {query_status}")
