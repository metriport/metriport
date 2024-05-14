import { DocumentReference, Extension } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import { makeBinary } from "../../__tests__/binary";
import { makePatient } from "../../__tests__/patient";

// TODO make this dynamic
export const makeDocumentReference = ({
  id,
  patient,
  binary,
  baseURL,
  extension,
}: {
  id?: string;
  patient?: ReturnType<typeof makePatient>;
  binary?: ReturnType<typeof makeBinary>;
  baseURL?: string;
  extension?: Extension[];
} = {}): DocumentReference => {
  const _patient = patient ?? makePatient();
  const _binary = binary ?? makeBinary();
  return {
    resourceType: "DocumentReference",
    id: id ?? uuidv4(),
    contained: [
      {
        resourceType: "Organization",
        id: "2.16.840.1.113883.3.9621.5.2004",
        name: "Metriport 2004",
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
    ...(extension ? { extension } : {}),
    content: [
      {
        attachment: {
          contentType: "application/json",
          url: `${baseURL ?? "http://localhost:8080"}/fhir/R4/Binary/${_binary.id}`,
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
