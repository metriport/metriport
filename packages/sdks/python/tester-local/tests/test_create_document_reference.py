import os

from generated.client import Metriport
from generated.resources.medical import UploadDocumentReference, Coding, CodeableConcept, DocumentReferenceContext

import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("METRIPORT_API_KEY")
patient_id = os.environ.get("PATIENT_ID")
facility_id = os.environ.get("FACILITY_ID")
base_url = os.environ.get("BASE_URL")


def test_start_doc_query() -> None:
    client = Metriport(api_key=api_key, base_url=base_url)

    coding = Coding(
        code="100556-0",
        system="http://loinc.org",
        display="Burn management Hospital Progress note"
    )

    type_codeable_concept = CodeableConcept(
        text="Burn management Hospital Progress note",
        coding=[coding]
    )

    facility_type = CodeableConcept(
        text="John Snow Clinic - Acute Care Centre"
    )

    document_reference_context = DocumentReferenceContext(
        period={
            "start": "2023-10-10T14:14:17Z",
            "end": "2023-10-10T15:30:30Z"
        },
        facilityType=facility_type
    )

    uploadDocumentReference = UploadDocumentReference(
        description="Third degree wrist burn treatment",
        type=type_codeable_concept,
        context=[document_reference_context]
    )

    response = client.medical.document.create_document_reference(
        patient_id=patient_id,
        request=uploadDocumentReference
    )
    print(f"Response: {response}")
