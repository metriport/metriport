import { Identifier } from "@metriport/commonwell-sdk";
import { Patient } from "../../models/medical/patient";
import * as nanoid from "nanoid";
import { driversLicenseURIs } from "../../shared/oid";

const cwURL = "https://sandbox.rest.api.commonwellalliance.org";
const cwLabel = "abcd123-1234-dedee-asd9-cnil132uil3n";

const orgRoute = "v1/org";
const personRoute = "v1/person";

const idAlphabet = "123456789";
export const primaryPersonId = nanoid.customAlphabet(idAlphabet, 6)();

export const createPatient = (patient: Patient, localOrgId: string, localOrgName: string) => {
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
      address: [patient.data.address],
      name: [
        {
          use: "usual",
          family: [patient.data.lastName],
          given: [patient.data.firstName],
        },
      ],
      gender: {
        code: patient.data.genderAtBirth,
        display: "Male",
      },
      birthDate: patient.data.dob,
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
        href: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgId}/patient/${patient.id}/networkLink`,
      },
      self: {
        href: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgId}/patient/${patient.id}/`,
      },
    },
  };
};

export const createPatientLinks = (patientIdentifier: Identifier[] | undefined) => {
  const patientId =
    patientIdentifier?.length && patientIdentifier[0].key ? patientIdentifier[0].key : "";

  const orgId =
    patientIdentifier?.length && patientIdentifier[0].system ? patientIdentifier[0].system : "";

  return {
    networkLink: {
      href: `${cwURL}/${orgRoute}/${orgId}/patient/${patientId}/networkLink`,
    },
    self: {
      href: `${cwURL}/${orgRoute}/${orgId}/patient/${patientId}/`,
    },
  };
};

export const createPerson = (patient: Patient, localOrgName: string) => {
  const personUrl = `${cwURL}/${personRoute}/${primaryPersonId}`;
  return {
    details: {
      address: [patient.data.address],
      name: [
        {
          use: "usual",
          family: [patient.data.lastName],
          given: [patient.data.firstName],
        },
      ],
      gender: {
        code: patient.data.genderAtBirth,
        display: "Male",
      },
      birthDate: patient.data.dob,
    },
    enrolled: true,
    enrollmentSummary: {
      dateEnrolled: "2023-03-05T16:17:10.074Z",
      enroller: localOrgName,
    },
    _links: {
      self: {
        href: personUrl,
      },
      patientLink: {
        href: `${personUrl}/patientLink`,
      },
      patientMatch: {
        href: `${personUrl}/patientMatch?orgId=${patient.id}`,
      },
      unenroll: {
        href: `${personUrl}/unenroll`,
      },
    },
  };
};

export const createPatientLink = (patientId: string, localOrgId: string) => {
  const linkUrl = `${cwURL}/${personRoute}/${primaryPersonId}/patientLink/${patientId}`;
  return {
    _links: {
      self: {
        href: linkUrl,
      },
    },
    _embedded: {
      patientLink: [
        {
          patient: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgId}/patient/${patientId}/`,
          assuranceLevel: "2",
          _links: {
            self: {
              href: linkUrl,
            },
            reset: {
              href: `${linkUrl}/reset`,
            },
          },
        },
      ],
    },
  };
};

const secondaryPersonId = nanoid.customAlphabet(idAlphabet, 6)();
export const searchPersonByPatientDemo = (
  patient: Patient,
  orgId: string,
  localOrgName: string
) => {
  const person = createPerson(patient, localOrgName);
  const personUrl = `${cwURL}/${personRoute}/${secondaryPersonId}`;

  return {
    message: "CommonWell found 1 Persons matching your search criteria.",
    _links: {
      self: {
        href: `${cwURL}/${orgRoute}/${orgId}/patient/${patient.id}/person`,
      },
    },
    _embedded: {
      person: [
        {
          ...person,
          details: {
            ...person.details,
            address: [
              {
                use: "home",
                line: ["543 sw 61th ave"],
                city: "Cleveland",
                state: "OH",
                zip: "54321",
              },
            ],
          },
          _links: {
            self: {
              href: personUrl,
            },
            patientLink: {
              href: `${personUrl}/patientLink`,
            },
            patientMatch: {
              href: `${personUrl}/patientMatch?orgId=${patient.id}`,
            },
            unenroll: {
              href: `${personUrl}/unenroll`,
            },
          },
        },
      ],
    },
  };
};

export const searchPersonByStrongId = (patient: Patient, localOrgName: string) => {
  const person = createPerson(patient, localOrgName);
  const state = patient.data.personalIdentifiers[0].state
    ? patient.data.personalIdentifiers[0].state
    : "FL";

  return [
    {
      ...person,
      details: {
        ...person.details,
        identifier: [
          {
            use: "usual",
            system: driversLicenseURIs[state],
            key: patient.data.personalIdentifiers[0].value,
          },
        ],
      },
    },
  ];
};
