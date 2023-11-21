from metriport import BaseOrganization, OrgType, Address, UsState
from metriport.client import AsyncMetriport

import asyncio

metriport_client = AsyncMetriport(api_key="YOUR_API_KEY")

async def create_organization():
  document = metriport_client.medical.organization.create(BaseOrganization(
      type=OrgType.PostAcuteCare,
      name="Metriport Inc.",
      location=Address(
        addressLine1="2261 Market Street",
        addressLine2="#4818",
        city="San Francisco",
        state=UsState.CA,
        zip="94114",
        country="USA",
      )
    ));

asyncio.run(create_organization())