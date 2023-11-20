""""Utility for working with metriport."""


import logging
import httpx
import pydantic
import asyncio
from typing import Optional

logging.basicConfig(level=logging.INFO)

import gcp
import env

_METRIPORT_SANDBOX_URL = "https://api.sandbox.metriport.com/"
_METRIPORT_PROD_URL = "https://api.metriport.com/"


class MetriportAuth(httpx.Auth):
    def __init__(self):
        try:
            gcp_instance = gcp.GCP()
            self.api_key = gcp_instance.get_secret("METRIPORT_SECRET_KEY")
        except Exception as exc:
            raise

    def auth_flow(self, request: httpx.Request):
        if self.api_key:
            request.headers["x-api-key"] = self.api_key
        yield request



def default_client() -> httpx.Client:
    return client(timeout=30, transport=httpx.HTTPTransport(retries=3))


def default_async_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=_METRIPORT_PROD_URL if env.is_prod() else _METRIPORT_SANDBOX_URL,
        auth=MetriportAuth(),
        timeout=30,
        transport=httpx.AsyncHTTPTransport(retries=3),
    )

def client(**kwargs) -> httpx.Client:
    return httpx.Client(
        base_url=_METRIPORT_PROD_URL if env.is_prod() else _METRIPORT_SANDBOX_URL,
        auth=MetriportAuth(),
        **kwargs,
    )

# An openapispec would make this a lot easier.
class Address(pydantic.BaseModel):
    addressLine1: str = pydantic.Field(min_length=1)
    addressLine2: Optional[str] = None
    city: str = pydantic.Field(min_length=1)
    state: str = pydantic.Field(min_length=1)
    zip: str = pydantic.Field(min_length=5, max_length=5)

    @pydantic.validator("zip", always=True)
    def check_zip_alphanumeric(cls, v):  # pylint: disable=no-self-argument
        int(v)
        return v


class Contact(pydantic.BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None

class Patient(pydantic.BaseModel):
    id: Optional[str] = None
    firstName: str = pydantic.Field(min_length=1)
    lastName: str = pydantic.Field(min_length=1)
    dob: str = pydantic.Field(min_length=1)
    genderAtBirth: str = pydantic.Field(min_length=1, max_length=1)
    address: list[Address]
    contact: Optional[list[Contact]] = None
    externalId: Optional[str] = None

async def upload_new_patient(
    metriport_facility_id: str, patient: Patient, client=None
) -> httpx.Response:
    if client is None:
        client = default_async_client()

    result = await client.post(
        "/medical/v1/patient",
        params={"facilityId": metriport_facility_id},
        content=patient.json(exclude_none=True),
        headers={"Content-Type": "application/json"},
    )
    return result

async def get_patient(
        patient_id: str, 
        client=None
) -> httpx.Response:
    if client is None:
        client = default_async_client()

    result = await client.get(
        f"/medical/v1/patient/{patient_id}",
    )
    return result

async def post_document_query(
    patient_id: str, 
    facility_id: str,  
    metadata: Optional[dict] = None, 
    override: bool = False,
    client=None
) -> httpx.Response:
    if client is None:
        client = default_async_client()

    result = await client.post(
        "/medical/v1/document/query",
        params={
            "patientId": patient_id,
            "facilityId": facility_id,
            "override": override
        },
        content=metadata,
        headers={"Content-Type": "application/json"},
    )
    return result    

async def post_consolidated_query(
    patient_id: str, 
    resources: Optional[str] = None,
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
    conversionType: Optional[str] = None,
    metadata: Optional[dict] = None, 
    client=None
) -> httpx.Response:
    if client is None:
        client = default_async_client()

    result = await client.post(
        f"/medical/v1//patient/{patient_id}/consolidated/query",
        params={
            "resources": resources,
            "dateFrom": dateFrom,
            "dateTo": dateTo,
            "conversionType": conversionType
        },
        content=metadata,
        headers={
            "Content-Type": "application/json",
        },
    )
    return result

def _already_included(patient: Patient, email_index: dict, phone_index: dict) -> bool:
    for contact in patient.contact:
        if contact.phone and contact.phone in phone_index:
            return True
        if contact.email and contact.email in email_index:
            return True
    return False


async def sync_patients(
    metriport_facility_id: str, patients: list[Patient], client=None
) -> list[httpx.Response]:
    if client is None:
        client = default_async_client()

    existing_patients_query = await client.get(
        "/medical/v1/patient", params={"facilityId": metriport_facility_id}
    )
    parsed_patients = (
        Patient.parse_obj(row)
        for row in existing_patients_query.raise_for_status().json()["patients"]
    )
    existing_patients = {patient.id: patient for patient in parsed_patients}
    # Identify existing patients by identical emails or phone numbers
    email_index = {}
    phone_index = {}
    for metriport_id, row in existing_patients.items():
        for contact_info in row.contact:
            if contact_info.phone:
                phone_index[contact_info.phone] = metriport_id
            if contact_info.email:
                email_index[contact_info.email] = metriport_id
    # TODO(ali): Handle incremental update
    promises = []
    for patient in patients:
        if not _already_included(patient, email_index, phone_index):
            promises.append(upload_new_patient(metriport_facility_id, patient))
    return [await promise for promise in promises]
    
async def main():
    # Instantiate the HTTP client
    client = default_async_client()

    facility_id = env.get_env_var("METRIPORT_FACILITY_ID")

    gcp_instance = gcp.GCP()
    upload_response = await upload_new_patient(
        metriport_facility_id=gcp_instance.get_secret("METRIPORT_FACILITY_ID"),
        patient=Patient(
            firstName="Aamina",
            lastName="Alexander",
            dob="1990-01-01",
            genderAtBirth="M",
            address=[
                Address(
                    addressLine1="2261 Market Street",
                    addressLine2="#4818",
                    city="San Francisco",
                    state="CA",
                    zip="94114",
                )
            ],
            contact=[
                Contact(email="test@tester.com", phone="4155555555"),
            ],
            externalId="12345",
        ), 
        client=client,
    )

    patient_id = upload_response.json().get('id')

    document_query_response = await post_document_query(
        patient_id=patient_id,
        facility_id=facility_id,
        override=True,
        client=client,
    )

    if document_query_response.status_code == 200:
        upload_data = document_query_response.json()
        print(upload_data)  # Or process the data as needed
    else:
        print("Error:", document_query_response.status_code)

# Run the main function
if __name__ == "__main__":
    asyncio.run(main())

