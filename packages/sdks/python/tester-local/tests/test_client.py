import os

from generated.client import Metriport
from generated import commons
from generated.resources import medical
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("METRIPORT_API_KEY")
base_url = os.environ.get("BASE_URL")

def test_client() -> None:
    client = Metriport(api_key=api_key, base_url=base_url)
    response = client.medical.organization.create(request=medical.OrganizationCreate(
      name="my-org", 
      type=medical.OrgType.ACUTE_CARE, 
      location=commons.Address(
        addressLine1="line1",
        addressLine2="line2",
        city="New York",
        state=commons.UsState.NY,
        country="USA",
        zip="10003"
        )
      )
    )
    print(f"Received response with {response.id}")