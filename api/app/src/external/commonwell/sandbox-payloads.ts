import * as nanoid from "nanoid";
import { Patient } from "@metriport/commonwell-sdk";
import { driversLicenseURIs } from "../../shared/oid";

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
    patient.identifier?.length && patient.identifier[0].key ? patient.identifier[0].key : "";
  const orgId =
    patient.identifier?.length && patient.identifier[0].system ? patient.identifier[0].system : "";

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

export const createPatient = (localOrgId: string, localOrgName: string, patientId: string) => {
  return {
    active: true,
    identifier: [
      {
        use: "usual",
        label: localOrgName,
        system: `urn:oid:${localOrgId}`,
        key: `${localOrgId}.2.100`,
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
      reference: `${cwURL}/v1/org/${localOrgId}/`,
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
        href: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgId}/patient/${patientId}/networkLink`,
      },
      self: {
        href: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgId}/patient/${patientId}/`,
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
