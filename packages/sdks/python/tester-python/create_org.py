import os
from metriport.client import Metriport
from metriport import commons
from metriport.resources import medical

from dotenv import load_dotenv

load_dotenv()

def test_client() -> None:
    client = Metriport(api_key=get_api_key(), base_url="http://localhost:8080")
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


def get_api_key() -> str:
    api_key = os.environ.get("METRIPORT_API_KEY")
    if api_key is None:
        raise Exception("METRIPORT_API_KEY not found")
    return api_key


if __name__ == "__main__":
    test_client()