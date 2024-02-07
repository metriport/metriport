import { Organization } from "@metriport/core/domain/organization";
import { Organization as FHIROrganization } from "@medplum/fhirtypes";

export const toFHIR = (org: Organization): FHIROrganization => {
  return {
    resourceType: "Organization",
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

export const appendIdentifierOID = (org: Organization, fhirOrg: FHIROrganization) => {
  fhirOrg.identifier = [{ value: org.oid }];
  return fhirOrg;
};
