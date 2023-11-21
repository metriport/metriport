import os

from .generated.client import Metriport
from .generated import commons
from .generated.resources import medical


client = Metriport(api_key=os.getenv("METRIPORT_API_KEY"))
response = client.medical.organization.create(request=medical.OrganizationCreate(
  name="my-org", 
  type=medical.OrgType.ACUTE_CARE, 
  location=commons.Address(
    addressLine1="line1",
    city="New York",
    state=commons.UsState.NY,
    country="USA"
    )
  )
)
print(f"Received response with {response.id}")
