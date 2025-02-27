import os

from generated.client import Metriport

import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("API_KEY")
patient_id = os.environ.get("PATIENT_ID")
base_url = os.environ.get("BASE_URL")

def test_get_all_patients_paginated() -> None:
    """
    The function `get_all_patients` retrieves a list of all patients from a medical API and prints their
    IDs.
    """
    metriport = Metriport(api_key=api_key, base_url=base_url)
    response = metriport.medical.patient.list(count=5)
    for patient in response.patients:
        print(f"Received patient with ID: {patient.id}")

def test_get_all_patients_unpaginated() -> None:
    """
    The function `get_all_patients` retrieves a list of all patients from a medical API and prints their
    IDs.
    """
    metriport = Metriport(api_key=api_key, base_url=base_url)
    response = metriport.medical.patient.list()
    for patient in response.patients:
        print(f"Received patient with ID: {patient.id}")

def test_get_specific_patient() -> None:
    """
    The function `get_patient` retrieves a patient from a medical API and prints their
    ID.
    """
    metriport = Metriport(api_key=api_key, base_url=base_url)
    response = metriport.medical.patient.get(id=patient_id)
    print(f"Received specific patient with ID: {response.id}")
