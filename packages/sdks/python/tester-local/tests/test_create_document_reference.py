import os

from generated.client import Metriport
from generated.resources.fhir import DocumentReference, CodeableConcept, Coding, DocumentReferenceContext, DocumentReferenceContent, Attachment

import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("API_KEY")
patient_id = os.environ.get("PATIENT_ID")
facility_id = os.environ.get("FACILITY_ID")
base_url = os.environ.get("BASE_URL")


def test_create_document_reference() -> None:
    metriport = Metriport(api_key=api_key, base_url=base_url)


    coding = Coding (
        system="http://loinc.org",
        code="3141-9",
        display="Body weight Measured"
    )

    # Create a CodeableConcept instance
    codeable_concept = CodeableConcept(
        coding=[coding],
    )

    facility_type = CodeableConcept (
        text="John Snow Clinic - Acute Care Centre"
    )

    document_reference_context = DocumentReferenceContext(
        period= {
            "start": "2023-10-10T14:14:17Z",
            "end": "2023-10-10T15:30:30Z"
        },
        facilityType=facility_type
    )

    document_reference_content = DocumentReferenceContent(attachment=Attachment())

    uploadDocumentReference = DocumentReference(
        resource_type="DocumentReference",
        content=[document_reference_content],
        description="Third degree wrist burn treatment",
        type=codeable_concept,
        context=document_reference_context
    )

    response = metriport.medical.document.create_document_reference(
        patient_id=patient_id,
        request=uploadDocumentReference
    )
    print(f"Response: {response}")
