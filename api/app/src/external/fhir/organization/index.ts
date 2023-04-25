import { Organization } from "../../../models/medical/organization";
import { Organization as FHIROrganization } from "@medplum/fhirtypes";
import { ResourceType } from "../shared";

export const toFHIR = (org: Organization): FHIROrganization => {
  return {
    resourceType: ResourceType.Organization,
    id: org.id,
    active: true,
    type: [
      {
        text: org.data.type,
      },
    ],
    name: org.data.name,
    address: [
      {
        line: [org.data.location.addressLine1],
        city: org.data.location.city,
        state: org.data.location.state,
        postalCode: org.data.location.zip,
        country: org.data.location.country,
      },
    ],
  };
};
