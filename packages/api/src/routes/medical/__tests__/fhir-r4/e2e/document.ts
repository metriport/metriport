import { faker } from "@faker-js/faker";
import { DocumentReference } from "@medplum/fhirtypes";
import { randomInt } from "../../../../../shared/numbers";
import { baseURL, nanoid } from "../../../../__tests__/shared";
import { makeBinary } from "./binary";
import { makePatient } from "./patient";

const defaultId = "2.16.840.1.113883.3.9621.5." + nanoid();

const smallId = () => String(randomInt(3)).padStart(3, "0");

export const makeDocument = ({
  id,
  patient,
  binary,
}: {
  id?: string;
  patient?: ReturnType<typeof makePatient>;
  binary?: ReturnType<typeof makeBinary>;
} = {}): DocumentReference => {
  const _patient = patient ?? makePatient();
  const _binary = binary ?? makeBinary();
  const practitionerId = smallId();
  const practitionerRef = `auth${practitionerId}`;

  return {
    resourceType: "DocumentReference",
    id: id ?? defaultId,
    contained: [
      {
        resourceType: "Organization",
        id: "2.16.840.1.113883.3.9621.5.2004",
        name: "Metriport 2004",
      },
      {
        resourceType: "Practitioner",
        id: `auth${practitionerId}`,
      },
    ],
    masterIdentifier: {
      system: "urn:ietf:rfc:3986",
      value: "2.16.840.1.113883.3.9621.5.2004.666001",
    },
    identifier: [
      {
        use: "official",
        system: "urn:ietf:rfc:3986",
        value: "2.16.840.1.113883.3.9621.5.2004.666001",
      },
    ],
    status: "current",
    extension: [
      {
        valueCoding: {
          code: "METRIPORT",
        },
      },
    ],
    type: {
      coding: [
        {
          system: "http://loinc.org/",
          code: "75622-1",
          display: "HIV 1 and 2 tests - Meaningful Use set",
        },
      ],
    },
    subject: {
      reference: `Patient/${_patient.id}`,
      type: "Patient",
    },
    author: [
      {
        reference: practitionerRef,
        type: "Practitioner",
      },
    ],
    description: "Summarization Of Episode Notes - provided by Metriport",
    content: [
      {
        attachment: {
          contentType: "application/json",
          url: `${baseURL}/fhir/R4/Binary/${_binary.id}`,
          title: faker.lorem.sentence(),
        },
        extension: [
          {
            valueCoding: {
              code: "METRIPORT",
            },
          },
        ],
      },
    ],
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
          text: "AIDS",
        },
      ],
      period: {
        start: "2022-10-05T22:00:00.000Z",
        end: "2022-10-05T23:00:00.000Z",
      },
      sourcePatientInfo: {
        reference: "#2.16.840.1.113883.3.9621.5.2004.2.118",
        type: "Patient",
      },
    },
  };
};
