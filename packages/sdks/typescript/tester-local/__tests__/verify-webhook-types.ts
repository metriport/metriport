import { WebhookPatientDocumentDataPayload } from "../src/api/resources/medical/resources/webhooks/types/WebhookPatientDocumentDataPayload";
import { WebhookPatientConsolidatedDataPayload } from "../src/api/resources/medical/resources/webhooks/types/WebhookPatientConsolidatedDataPayload";
import { MapiWebhookStatus } from "../src/api/resources/medical/resources/webhooks/types/MapiWebhookStatus";

const documentDataPayload = {
  meta: {
    messageId: "<message-id>",
    when: "<date-time-in-utc>",
    type: "medical.document-bulk-download-urls",
    data: {
      youCan: "putAny",
      stringKeyValue: "pairsHere",
    },
  },
  patients: [
    {
      patientId: "<patient-id-1>",
      externalId: "<external-id-1>",
      type: "document-download",
      status: MapiWebhookStatus.Completed,
      documents: [
        {
          id: "1.2.543.1.34.1.34.134",
          fileName: "CCDA_Diag.xml",
          description: "Patient Diagnoses",
          status: "current",
          indexed: "2019-09-07T15:50:00.000Z",
          mimeType: "application/xml",
          size: parseInt("17344007"),
          type: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "62479008",
                display: "Diagnoses",
              },
            ],
            text: "Diagnoses",
          },
        },
        {
          id: "1.2.543.1.224.54.22.540",
          fileName: "Progress_Notes.xml",
          description: "Patient Encounter Progress Notes 2023-03-22",
          status: "current",
          indexed: "2023-03-22T08:34:00.000Z",
          mimeType: "application/xml",
          size: parseInt("8675545"),
          type: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "371532007",
                display: "Progress Report",
              },
            ],
            text: "Progress Notes",
          },
        },
      ],
    },
  ],
};

export const consolidatedDataPayload = {
  meta: {
    messageId: "1e82424a-1220-473d-a0d1-6e5fde15159e",
    when: "2023-08-23T22:09:11.373Z",
    type: "medical.consolidated-data",
  },
  patients: [
    {
      patientId: "eddeefa1-b54a-41d6-854f-0e91b7871d6a",
      status: MapiWebhookStatus.Completed,
      bundle: {
        resourceType: "Bundle",
      },
    },
  ],
};

describe("Webhook types", () => {
  it("should match the WebhookPatientDocumentDataPayload type", async () => {
    // if it compiles the type is correct
    const parsedPayload: WebhookPatientDocumentDataPayload = documentDataPayload;
    expect(!!parsedPayload).toBe(true);
  });

    it('should match the WebhookPatientConsolidatedDataPayload type', async () => {
      const parsedPayload: WebhookPatientConsolidatedDataPayload = consolidatedDataPayload;
      expect(true).toBe(true);
    });
});


// patients: [
  //   {
  //     patientId: "eddeefa1-b54a-41d6-854f-0e91b7871d6a",
  //     externalId: "1234567890",
  //     status: MapiWebhookStatus.Completed,
  //     filters: {
  //       resources: "DocumentReference,Appointment",
  //     },
  //     bundle: {
  //       type: "searchset",
  //       resourceType: "Bundle",
  //       total: 1,
  //       entry: [
  //         {
  //           resource: {
  //             resourceType: "Appointment",
  //             id: "123",
  //             start: "2021-06-10T13:00:00.000Z",
  //             end: "2021-06-10T13:55:00.000Z",
  //             status: "booked",
  //             meta: {
  //               source: "#cXWJjuhQX33LJ0VJrPiD0",
  //               versionId: "2",
  //               lastUpdated: "2023-08-23T12:41:54.661-05:00",
  //             },
  //             contained: [
  //               {
  //                 id: "eddeefa1-b54a-41d6-854f-0e91b7871d6a",
  //                 meta: {
  //                   source: "#4fh35tN5_DjOxfVrq3dfi",
  //                 },
  //                 name: [
  //                   {
  //                     given: ["John"],
  //                     family: "Doe",
  //                   },
  //                 ],
  //                 gender: "male",
  //                 address: [
  //                   {
  //                     country: "USA",
  //                     postalCode: "12345",
  //                   },
  //                 ],
  //                 birthDate: "1981-01-01",
  //                 resourceType: "Patient",
  //               },
  //             ],
  //             participant: [
  //               {
  //                 actor: {
  //                   display: "John Doe",
  //                   reference: "Patient/eddeefa1-b54a-41d6-854f-0e91b7871d6a",
  //                 },
  //                 period: {
  //                   end: "2021-05-24T13:21:28.527Z",
  //                   start: "2021-05-24T13:21:28.527Z",
  //                 },
  //                 status: "accepted",
  //               },
  //             ],
  //           },
  //         },
  //       ],
  //     },
  //   },
  // ],