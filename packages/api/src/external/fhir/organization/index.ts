import { Narrative, Organization as FHIROrganization } from "@medplum/fhirtypes";
import { Organization } from "@metriport/core/domain/organization";

export const toFHIR = (org: Organization): FHIROrganization => {
  const text = getTextFromOrganization(org);
  return {
    resourceType: "Organization",
    id: org.id,
    text,
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

/**
 * 'A resource should have narrative for robust management' (defined in
 * http://hl7.org/fhir/StructureDefinition/DomainResource) (Best Practice Recommendation)
 * @returns Narrative with human readable content
 */
export function getTextFromOrganization(org: Organization): Narrative {
  return {
    status: "generated",
    div: `<div xmlns="http://www.w3.org/1999/xhtml">${org.data.name}</div>`,
  };
}

export const appendIdentifierOID = (org: Organization, fhirOrg: FHIROrganization) => {
  fhirOrg.identifier = [{ value: org.oid }];
  return fhirOrg;
};
