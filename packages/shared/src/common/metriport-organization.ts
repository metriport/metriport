import { Organization } from "@medplum/fhirtypes";

// TODO move this to the shared/domain package
export const metriportOrganization: Organization = {
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
      value: "+1-615-344-9551",
      use: "work",
    },
  ],
};
