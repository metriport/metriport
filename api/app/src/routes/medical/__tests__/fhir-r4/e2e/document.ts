import { makeBinary } from "./binary";
import { makePatient } from "./patient";
import { baseURL, nanoid } from "./shared";

const defaultId = "2.16.840.1.113883.3.9621.5." + nanoid();

export const makeDocument = ({
  id,
  patient,
  binary,
}: {
  id?: string;
  patient?: ReturnType<typeof makePatient>;
  binary?: ReturnType<typeof makeBinary>;
}) => {
  const _patient = patient ?? makePatient();
  const _binary = binary ?? makeBinary();
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
        resourceType: "Patient",
        id: _patient.id,
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
        reference: "#2.16.840.1.113883.3.9621.5.2004",
        type: "Organization",
      },
    ],
    description: "Summarization Of Episode Notes - provided by Metriport",
    content: [
      {
        attachment: {
          contentType: "application/json",
          url: `${baseURL}/fhir/R4/Binary/${_binary.id}`,
        },
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
