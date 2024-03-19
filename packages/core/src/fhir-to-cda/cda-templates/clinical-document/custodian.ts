import { Organization } from "@medplum/fhirtypes";
import { buildRepresentedOrganization } from "../commons";
import { CDACustodian } from "../types";

const METRIPORT_ORGANIZATION: Organization = {
  resourceType: "Organization",
  name: "Metriport",
  address: [
    {
      line: ["2261 Market St, #4818"],
      city: "San Francisco",
      state: "CA",
      postalCode: "94114",
      country: "US",
    },
  ],
  telecom: [
    {
      system: "phone",
      value: "tel:+1-(615)344-9551",
      use: "work",
    },
  ],
};

export function buildCustodian(): CDACustodian | undefined {
  const custodian = {
    assignedCustodian: {
      representedCustodianOrganization: buildRepresentedOrganization(METRIPORT_ORGANIZATION),
    },
  };
  return custodian;
}
