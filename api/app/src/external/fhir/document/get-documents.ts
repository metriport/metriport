import { DocumentReference } from "@medplum/fhirtypes";
import { Config } from "../../../shared/config";
import { makeFhirApi } from "../api";

export function getDocumentSandboxPayload(patientId: string): DocumentReference[] {
  return [
    {
      resourceType: "DocumentReference",
      id: "12345",
      meta: {
        versionId: "1",
        lastUpdated: "2023-04-19T01:39:15.337+00:00",
        source: "#12345",
      },
      contained: [
        {
          resourceType: "Organization",
          id: "1.2.3.4.5.6.7.8.9",
          name: "Organization",
        },
        {
          resourceType: "Patient",
          id: patientId,
        },
      ],
      extension: [
        {
          valueReference: {
            reference: "COMMONWELL",
          },
        },
      ],
      masterIdentifier: {
        system: "urn:ietf:rfc:1234",
        value: "1.2.3.4.5.6.7.8.9",
      },
      identifier: [
        {
          use: "official",
          system: "urn:ietf:rfc:1234",
          value: "1.2.3.4.5.6.7.8.9",
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
        reference: `Patient/${patientId}`,
        type: "Patient",
      },
      date: "2023-04-19T01:39:13+00:00",
      author: [
        {
          reference: "#1.2.3.4.5.6.7.8.9",
          type: "Organization",
        },
      ],
      custodian: {
        id: "1.2.3.4.5.6.7.8.9",
      },
      description: "Summarization Of Episode Notes - provided by Metriport",
      content: [
        {
          attachment: {
            contentType: "application/pdf",
            url: "https://testing-documents-download.s3.us-east-2.amazonaws.com/21fa432e-723b-4a1d-a3b2-bd9cd75a0717-Mi4xNi44NDAuMS4xMTM4ODMuMy45NjIxLjUuMjAwNC42NjYwMDE%3D",
            title:
              "21fa432e-723b-4a1d-a3b2-bd9cd75a0717-Mi4xNi44NDAuMS4xMTM4ODMuMy45NjIxLjUuMjAwNC42NjYwMDE=",
            creation: "2023-04-19T01:39:13+00:00",
          },
        },
      ],
      context: {
        event: [
          {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "123456",
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
  ];
}

export const getDocuments = async ({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<DocumentReference[] | undefined> => {
  // Until we have FHIR in sandbox
  if (Config.isSandbox()) {
    return getDocumentSandboxPayload(patientId);
  }
  const api = makeFhirApi(cxId);
  const docs: DocumentReference[] = [];
  for await (const page of api.searchResourcePages("DocumentReference", `patient=${patientId}`)) {
    docs.push(...page);
  }
  return docs;
};
