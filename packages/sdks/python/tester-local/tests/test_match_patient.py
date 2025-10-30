import os

from generated.client import Metriport
from generated import UsState, Address
from generated.medical import BasePatient, PersonalIdentifier_DriversLicense, Demographics

import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("API_KEY")
facility_id = os.environ.get("FACILITY_ID")
base_url = os.environ.get("BASE_URL")


def test_match_patient() -> None:
    metriport = Metriport(api_key=api_key, base_url=base_url)
    metriport.medical.patient.create(
      facility_id=facility_id,
              first_name="John",
        last_name="Doe",
        dob="1980-01-01",
        gender_at_birth="M",
        personal_identifiers=[
            PersonalIdentifier_DriversLicense(
                type="driversLicense",
                state='CA',
                value="12345678",
            )
        ],
        address=[Address(
            address_line_1="123 Main St",
            city="Los Angeles",
            state='CA',
            zip="90001",
            country="USA"
        )]
    )
    response = metriport.medical.patient.match(
        first_name="John",
        last_name="Doe",
        dob="1980-01-01",
        gender_at_birth="M",
        personal_identifiers=[
            PersonalIdentifier_DriversLicense(
                type="driversLicense",
                state='CA',
                value="12345678",
            )
        ],
        address=[Address(
            address_line_1="123 Main St",
            city="Los Angeles",
            state='CA',
            zip="90001",
            country="USA"
        )]
    )
    print(f"Received patient with ID: {response.id}")
