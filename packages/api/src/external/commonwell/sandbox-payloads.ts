import * as nanoid from "nanoid";
import { Patient } from "@metriport/commonwell-sdk";
import { driversLicenseURIs } from "@metriport/core/domain/oid";
import { DocumentQueryResponse } from "@metriport/commonwell-sdk";
import { uuidv7 } from "@metriport/core/util/uuid-v7";

const cwURL = "https://sandbox.rest.api.commonwellalliance.org";
const cwLabel = "abcd123-1234-dedee-asd9-cnil132uil3n";

const orgRoute = "v1/org";
const personRoute = "v1/person";

const idAlphabet = "123456789";
export const primaryPersonId = nanoid.customAlphabet(idAlphabet, 6)();

export const details = {
  address: [
    {
      use: "home",
      line: ["123"],
      city: "Miami",
      state: "FL",
      zip: "12345",
      country: "USA",
    },
  ],
  name: [
    {
      use: "usual",
      family: ["Doe"],
      given: ["John"],
    },
  ],
  gender: {
    code: "M",
    display: "Male",
  },
  birthDate: "1950-01-01T00:00:00Z",
  identifier: [],
};

export const createPatientWithLinks = (patient: Patient) => {
  const patientId =
    patient.identifier?.length && patient.identifier[0]?.key ? patient.identifier[0].key : "";
  const orgId =
    patient.identifier?.length && patient.identifier[0]?.system ? patient.identifier[0].system : "";

  return {
    ...patient,
    _links: {
      person: {
        href: `${cwURL}/${personRoute}/${primaryPersonId}`,
      },
      networkLink: {
        href: `${cwURL}/${orgRoute}/urn%3aoid%3a${orgId}/patient/${patientId}/networkLink`,
      },
      self: {
        href: `${cwURL}/${orgRoute}/urn%3aoid%3a${orgId}/patient/${patientId}/`,
      },
    },
  };
};

export const createPatient = (
  localOrgOID: string,
  localOrgName: string,
  patientId: string
): Patient => {
  return {
    active: true,
    identifier: [
      {
        use: "usual",
        label: localOrgName,
        system: `urn:oid:${localOrgOID}`,
        key: patientId,
        assigner: localOrgName,
      },
      {
        use: "official",
        label: `${cwLabel}`,
        system: "urn:oid:9.8.7.6.5.4.3.2.1",
        key: `urn:uuid:${cwLabel}`,
        assigner: "CommonWell",
      },
    ],
    provider: {
      type: "organization",
      reference: `${cwURL}/v1/org/${localOrgOID}/`,
      display: localOrgName,
    },
    details: {
      ...details,
      identifier: [
        {
          use: "usual",
          system: driversLicenseURIs.FL,
          key: "**********",
        },
      ],
    },
    _links: {
      person: {
        href: `${cwURL}/${personRoute}/${primaryPersonId}`,
      },
      networkLink: {
        href: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgOID}/patient/${patientId}/networkLink`,
      },
      self: {
        href: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgOID}/patient/${patientId}/`,
      },
    },
  };
};

export const createPerson = (orgId: string, orgName: string, personId: string) => {
  const personUrl = `${cwURL}/${personRoute}/${personId}`;

  return {
    details: details,
    enrolled: true,
    enrollmentSummary: {
      dateEnrolled: "2023-03-09T20:26:37.458Z",
      enroller: orgName,
    },
    _links: {
      self: {
        href: `${personUrl}`,
      },
      patientMatch: {
        href: `${personUrl}/patientMatch?orgId=${orgId}`,
      },
      patientLink: {
        href: `${personUrl}/patientLink`,
      },
      unenroll: {
        href: `${personUrl}/unenroll`,
      },
    },
  };
};

export const createPatientLink = (patientLink: string, patientId: string, orgId: string) => {
  return {
    _links: {
      self: {
        href: patientLink,
      },
    },
    _embedded: {
      patientLink: [
        {
          patient: `${cwURL}/${orgRoute}/${orgId}/patient/${patientId}`,
          assuranceLevel: "2",
          _links: {
            self: {
              href: `${patientLink}/${patientId}/`,
            },
            reset: {
              href: `${patientLink}/${patientId}/Reset`,
            },
          },
        },
      ],
    },
  };
};

export const createDocument = (orgId: string, orgName: string): DocumentQueryResponse => {
  return {
    resourceType: "Bundle",
    entry: [
      {
        id: `urn:uuid:${orgId}`,
        content: {
          resourceType: "DocumentReference",
          contained: [
            {
              resourceType: "Organization",
              id: "orgRef1",
              name: orgName,
            },
            {
              resourceType: "Practitioner",
              id: "authRef1",
              organization: {
                reference: "#orgRef1",
              },
            },
            {
              resourceType: "Patient",
              id: "patRef1",
              identifier: [
                {
                  system: "urn:oid:https://github.com/synthetichealth/synthea",
                  value: "e48c330b-d0d9-4bbd-9811-9c63cde19c7e",
                },
                {
                  system: "urn:oid:1.2.3.4.5.6.7.8.9Test Org2",
                  value: uuidv7(),
                },
              ],
              name: [
                {
                  family: ["Doe"],
                  given: ["John"],
                },
              ],
              gender: {
                coding: [
                  {
                    system:
                      "http://hl7.org/implement/standards/fhir/valueset-administrative-gender.html",
                    code: "M",
                  },
                ],
              },
              birthDate: "1975-05-05",
              address: [
                {
                  line: ["Brasil St"],
                  city: "Brasil",
                  state: "California",
                  zip: "12345",
                  country: "USA",
                },
              ],
            },
          ],
          masterIdentifier: {
            system: "urn:ietf:rfc:1234",
            value: `${orgId}`,
          },
          identifier: [
            {
              use: "official",
              system: "urn:ietf:rfc:1234",
              value: `urn:uuid:${orgId}`,
            },
          ],
          subject: {
            reference: "#patRef1",
          },
          type: {
            coding: [
              {
                system: "http://loinc.org/",
                code: "1234-1",
                display: "HIV 1 and 2 tests - Meaningful Use set",
              },
            ],
          },
          author: [
            {
              reference: "#authRef1",
            },
          ],
          indexed: "2023-03-16T01:22:20+00:00",
          status: "current",
          description: "Summarization Of Episode Notes - provided by Metriport",
          mimeType: "application/pdf",
          location: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          context: {
            event: [
              {
                coding: [
                  {
                    system: "http://snomed.info/sct",
                    code: "62479008",
                    display: "AIDS",
                  },
                ],
              },
            ],
            period: {
              start: "2022-10-05T22:00:00Z",
              end: "2022-10-05T23:00:00Z",
            },
          },
        },
      },
    ],
  };
};
