import os
from dotenv import load_dotenv
from generated.client import Metriport
from generated.resources.medical import ConsolidatedBundleUpload

load_dotenv()

api_key = os.environ.get("API_KEY")
patient_id = os.environ.get("PATIENT_ID")
base_url = os.environ.get("BASE_URL")

def test_create_patient_consolidated():
    client = Metriport(api_key=api_key, base_url=base_url)

    consolidated_bundle_upload = ConsolidatedBundleUpload(
        resourceType="Bundle",
        type="collection",
        entry=[
            {
                "resource": {
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
    query_status = client.medical.fhir.create_patient_consolidated(
        id=patient_id,
        request=consolidated_bundle_upload
    )
    print(f"queryStatus: {query_status}")
