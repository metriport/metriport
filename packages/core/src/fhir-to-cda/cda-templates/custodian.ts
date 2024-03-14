import { Organization } from "@medplum/fhirtypes";
import { constructRepresentedOrganization } from "./commons";

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

export function constructCustodian(): unknown {
  const custodian = {
    assignedCustodian: {
      representedCustodianOrganization: constructRepresentedOrganization(METRIPORT_ORGANIZATION),
    },
  };
  return custodian;
}
