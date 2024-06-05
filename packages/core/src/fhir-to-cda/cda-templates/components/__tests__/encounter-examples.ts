import { Encounter, Practitioner, Location } from "@medplum/fhirtypes";

export const encounter1: Partial<Encounter> = {
  status: "finished",
  class: {
    code: "99214",
    display: "OV EST PT LEV 4",
    system: "http://www.ama-assn.org/go/cpt",
  },
  type: [
    {
      text: "Urgent Care Office Visit",
      coding: [
        {
          code: "99214",
          display: "OV EST PT LEV 4",
          system: "http://www.ama-assn.org/go/cpt",
        },
      ],
    },
  ],
  period: { start: "2012-07-23T16:45:00.000Z", end: "2012-07-23T17:00:00.000Z" },
  reasonCode: [
    {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "444814009",
          display: "Viral sinusitis (disorder)",
        },
      ],
    },
    {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "82423001",
          display: "Chronic pain (finding)",
        },
      ],
    },
  ],
};

export const practitioner1: Partial<Practitioner> = {
  identifier: [{ system: "http://hl7.org/fhir/sid/us-npi", value: "1508174129" }],
  name: [{ family: "Zoidberg", given: ["John A."], suffix: ["MD"] }],
  address: [
    {
      use: "work",
      line: ["1111 Sample Street", "Suite 987"],
      city: "Springfield",
      state: "CA",
      country: "USA",
      postalCode: "12123",
    },
  ],
  telecom: [{ system: "phone", value: "+1-600-700-8000", use: "work" }],
  qualification: [
    {
      code: {
        text: "FAMILY MEDICINE PHYSICIAN",
        coding: [
          {
            code: "207Q00000X",
            display: "FAMILY MEDICINE PHYSICIAN",
            system: "http://nucc.org/provider-taxonomy",
          },
        ],
      },
    },
  ],
};

export const location1: Partial<Location> = {
  name: "Planet Express Medical Office",
  address: {
    use: "work",
    line: ["1111 Sample Street", "Suite 987"],
    city: "Springfield",
    state: "CA",
    country: "USA",
    postalCode: "12123",
  },
  type: [
    {
      text: "Urgent Care",
    },
  ],
};
