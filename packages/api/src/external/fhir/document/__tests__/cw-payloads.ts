import { faker } from "@faker-js/faker";
import { Contained, Document } from "@metriport/commonwell-sdk";
import { v4 as uuidv4 } from "uuid";
import { makePeriod } from "../../shared/__tests__/date";

const companyName1 = faker.company.name();

export const docRefsWithOneAuthorPointingToMultipleContained: Document[] = [
  // regular, two Practitioner authors w/ same ref
  {
    id: `urn:uuid:${uuidv4()}`,
    content: {
      resourceType: "DocumentReference",
      contained: [
        {
          resourceType: "Organization",
          id: "orgRef16",
          identifier: [
            {
              value: uuidv4(),
            },
          ],
          name: companyName1,
        },
        {
          resourceType: "Practitioner",
          id: "authRef16",
          name: {
            family: [companyName1],
            given: [""],
            prefix: [""],
          },
          organization: {
            reference: "#orgRef16",
          },
        },
        {
          resourceType: "Practitioner",
          id: "authRef16",
          name: {
            family: [faker.person.lastName()],
            given: [faker.person.firstName()],
            prefix: [""],
          },
        },
      ],
      masterIdentifier: {
        system: "urn:ietf:rfc:3986",
        value: uuidv4(),
      },
      identifier: [
        {
          use: "official",
          system: "urn:ietf:rfc:3986",
          value: `urn:uuid:${uuidv4()}`,
        },
      ],
      subject: {
        reference: "#patRef16",
      },
      type: {
        text: "Cardiology Imaging",
      },
      author: [
        {
          reference: "#authRef16",
        },
      ],
      indexed: faker.date.past().toISOString(),
      status: "current" as const,
      description: "ELECTROCARDIOGRAM, COMPLETE",
      mimeType: "application/pdf",
      format: ["urn:ihe:iti:xds:2017:mimeTypeSufficient"],
      location: faker.internet.url(),
      context: {
        period: makePeriod(),
        facilityType: {
          text: "MCP MEDICAL/NEUROLOGY/ONCOLOGY",
        },
      },
    },
  },
  // two authors w/ same ref, but one Org and one Practitioner
  {
    id: `urn:uuid:${uuidv4()}`,
    content: {
      resourceType: "DocumentReference",
      contained: [
        {
          resourceType: "Organization",
          id: "authRef16",
          identifier: [
            {
              value: uuidv4(),
            },
          ],
          name: companyName1,
        },
        {
          resourceType: "Practitioner",
          id: "authRef16",
          name: {
            family: [faker.person.lastName()],
            given: [faker.person.firstName()],
            prefix: [""],
          },
        },
      ],
      masterIdentifier: {
        system: "urn:ietf:rfc:3986",
        value: uuidv4(),
      },
      identifier: [
        {
          use: "official",
          system: "urn:ietf:rfc:3986",
          value: `urn:uuid:${uuidv4()}`,
        },
      ],
      subject: {
        reference: "#patRef16",
      },
      type: {
        text: "Cardiology Imaging",
      },
      author: [
        {
          reference: "#authRef16",
        },
      ],
      indexed: faker.date.past().toISOString(),
      status: "current" as const,
      description: "ELECTROCARDIOGRAM, COMPLETE",
      mimeType: "application/pdf",
      format: ["urn:ihe:iti:xds:2017:mimeTypeSufficient"],
      location: faker.internet.url(),
      context: {
        period: makePeriod(),
        facilityType: {
          text: "MCP MEDICAL/NEUROLOGY/ONCOLOGY",
        },
      },
    },
  },
];

export const docRefContainedPatientWithOrg: Contained = {
  resourceType: "Practitioner",
  id: "authRef16",
  name: {
    family: [faker.company.name()],
    given: [""],
    prefix: [""],
  },
  organization: {
    reference: "#orgRef16",
  },
};
