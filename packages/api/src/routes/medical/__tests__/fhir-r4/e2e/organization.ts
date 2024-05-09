import { nanoid } from "../../../../../__tests__/e2e/shared";

const defaultId = "2.16.840.1.113883.3.9621.5." + nanoid();

export const makeOrganization = (id = defaultId) => ({
  resourceType: "Organization",
  id,
  identifier: [
    {
      system: "https://github.com/synthetichealth/synthea",
      value: "ca0a97db-d47e-4fd0-93a7-d0b076bcb8dd",
    },
  ],
  type: [
    {
      active: true,
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/organization-type",
          code: "prov",
          display: "Healthcare Provider",
        },
      ],
      text: "Healthcare Provider",
    },
  ],
  name: `HOSPITAL ${id}`,
  telecom: [
    {
      system: "phone",
      value: "5088287000",
    },
  ],
  address: [
    {
      line: ["88 WASHINGTON STREET"],
      city: "TAUNTON",
      state: "MA",
      postalCode: "02780",
      country: "US",
    },
  ],
});
