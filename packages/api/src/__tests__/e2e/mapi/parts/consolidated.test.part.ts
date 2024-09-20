/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { isDocumentReference } from "@metriport/core/external/fhir/document/document-reference";
import { downloadToMemory } from "@metriport/core/util/file-downloader";
import { detectFileType } from "@metriport/core/util/file-type";
import { PDF_MIME_TYPE } from "@metriport/core/util/mime";
import { isValidUrl, sleep } from "@metriport/shared";
import { AxiosError } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import fs from "fs";
import { e2eResultsFolderName } from "../../shared";
import { cxId, E2eContext, medicalApi } from "../shared";
import { getConsolidatedWebhookRequest, resetConsolidatedData } from "../webhook/consolidated";
import { checkWebhookRequestMeta } from "../webhook/shared";
import {
  checkConsolidatedHtml,
  checkConsolidatedJson,
  createConsolidatedPayloads,
} from "./consolidated/consolidated";

dayjs.extend(isBetween);
dayjs.extend(duration);

const waitTimeAfterPutConsolidated = dayjs.duration({ seconds: 1 });

const conversionCheckStatusMaxRetries = 12;
const conversionCheckStatusWaitTime = dayjs.duration({ seconds: 10 });

export function runConsolidatedTests(e2e: E2eContext) {
  function createAndStoreConsolidatedData() {
    if (!e2e.patientFhir) throw new Error("Missing patientFhir");
    const payloads = createConsolidatedPayloads(e2e.patientFhir);
    e2e.consolidatedPayload = payloads.consolidated;
    e2e.allergyIntolerance = payloads.allergyIntolerance;
    e2e.documentReference = payloads.documentReference;
    e2e.binary = payloads.binary;
  }

  function resetWebhook() {
    resetConsolidatedData();
    e2e.url = undefined;
    e2e.mrContentBuffer = undefined;
    e2e.expectedWebhookMeta = undefined;
  }

  it("creates consolidated data", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    createAndStoreConsolidatedData();
    if (!e2e.consolidatedPayload) throw new Error("Missing consolidatedPayload");
    const consolidated = await medicalApi.createPatientConsolidated(
      e2e.patient.id,
      e2e.consolidatedPayload
    );
    e2e.putConsolidatedDataRequestId = medicalApi.lastRequestId;
    expect(consolidated).toBeTruthy();
    try {
      expect(consolidated.type).toEqual("transaction-response");
      expect(consolidated.entry).toBeTruthy();
      if (!consolidated.entry) throw new Error("Missing entry");
      expect(consolidated.entry.length).toEqual(2);
      expect(consolidated.entry).toEqual(
        expect.arrayContaining([
          {
            response: expect.objectContaining({
              status: "201 Created",
              location: expect.stringMatching(/AllergyIntolerance\/.+/),
              outcome: expect.objectContaining({
                resourceType: "OperationOutcome",
              }),
            }),
          },
          {
            response: expect.objectContaining({
              status: "201 Created",
              location: expect.stringMatching(/DocumentReference\/.+/),
              outcome: expect.objectContaining({
                resourceType: "OperationOutcome",
              }),
            }),
          },
        ])
      );
    } catch (err) {
      fs.writeFileSync(
        e2eResultsFolderName + "/consolidated-received.json",
        JSON.stringify(consolidated, null, 2)
      );
      fs.writeFileSync(
        e2eResultsFolderName + "/consolidated-expected.json",
        JSON.stringify(e2e.consolidatedPayload, null, 2)
      );
      throw err;
    }
  });

  it("awaits data to be replicated to FHIR server", async () => {
    await sleep(waitTimeAfterPutConsolidated.asMilliseconds());
  });

  it("counts consolidated data", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    if (!e2e.consolidatedPayload) throw new Error("Missing consolidatedPayload");
    const count = await medicalApi.countPatientConsolidated(e2e.patient.id);
    expect(count.total).toEqual(e2e.consolidatedPayload.entry?.length);
  });

  it("returns consolidated data", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    if (!e2e.consolidatedPayload) throw new Error("Missing consolidatedPayload");
    const consolidated = await medicalApi.getPatientConsolidated(e2e.patient.id);
    expect(consolidated).toBeTruthy();
    const consolidatedWithoutPatient = consolidated?.entry?.filter(
      e => e.resource?.resourceType !== "Patient"
    );
    const expectedContents = (e2e.consolidatedPayload?.entry ?? []).map(e =>
      expect.objectContaining({
        resource: expect.objectContaining({
          resourceType: e.resource?.resourceType,
          id: e.resource?.id,
        }),
      })
    );
    expect(consolidatedWithoutPatient).toBeTruthy();
    expect(consolidatedWithoutPatient?.length).toEqual(e2e.consolidatedPayload.entry?.length);
    expect(consolidatedWithoutPatient).toEqual(expect.arrayContaining(expectedContents));
  });

  async function waitAndCheckConversion(): Promise<void> {
    if (!e2e.patient) throw new Error("Missing patient");
    let conversionProgresses = await medicalApi.getConsolidatedQueryStatus(e2e.patient.id);
    let initConversionProgress = conversionProgresses?.queries?.[0];
    let retryLimit = 0;
    while (initConversionProgress?.status !== "completed") {
      if (retryLimit++ > conversionCheckStatusMaxRetries) {
        console.log(`Gave up waiting for Conversion`);
        break;
      }
      console.log(
        `Conversion still processing, retrying in ${conversionCheckStatusWaitTime.asSeconds()} seconds...`
      );
      await sleep(conversionCheckStatusWaitTime.asMilliseconds());
      conversionProgresses = await medicalApi.getConsolidatedQueryStatus(e2e.patient.id);
      initConversionProgress = conversionProgresses?.queries?.[0];
    }
    expect(conversionProgresses).toBeTruthy();
    expect(initConversionProgress?.status).toEqual("completed");
  }

  for (const format of ["json", "html", "pdf"]) {
    it(`triggers a conversion of consolidated into ${format} format`, async () => {
      if (!e2e.patient) throw new Error("Missing patient");
      const conversionProgress = await medicalApi.startConsolidatedQuery(
        e2e.patient.id,
        undefined,
        undefined,
        undefined,
        format
      );
      expect(conversionProgress).toBeTruthy();
      expect(conversionProgress.status).toEqual("processing");
    });

    it(`completes ${format} conversion successfully`, async () => {
      await waitAndCheckConversion();
    });

    it(`receives consolidated ${format} WH with correct meta`, async () => {
      const whRequest = getConsolidatedWebhookRequest();
      checkWebhookRequestMeta(whRequest, "medical.consolidated-data");
    });

    it(`receives consolidated ${format} WH with MR in ${format} format`, async () => {
      if (!e2e.patient) throw new Error("Missing patient");
      const whRequest = getConsolidatedWebhookRequest();
      const consolidatedData = whRequest?.patients;
      expect(consolidatedData).toBeTruthy();
      if (!consolidatedData) throw new Error("Missing consolidated data");
      expect(consolidatedData.length).toEqual(1);
      expect(consolidatedData[0].status).toEqual("completed");
      const bundle = consolidatedData[0].bundle;
      expect(bundle).toBeTruthy();
      if (!bundle) throw new Error("Missing Bundle");
      expect(bundle.type).toEqual("searchset");
      expect(bundle.resourceType).toEqual("Bundle");
      expect(bundle.total).toEqual(1);
      expect(bundle.entry).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            resource: expect.objectContaining({
              resourceType: "DocumentReference",
              content: expect.arrayContaining([
                expect.objectContaining({
                  attachment: expect.objectContaining({
                    contentType: `application/${format}`,
                  }),
                }),
              ]),
            }),
          }),
        ])
      );
      const docRefFromWebhook = (bundle.entry ?? []).map(e => e.resource).find(isDocumentReference);
      if (!docRefFromWebhook) {
        throw new Error("Missing DocumentReference");
      }
      const patientRef = docRefFromWebhook.subject?.reference;
      expect(patientRef).toBeTruthy();
      expect(patientRef).toEqual(`Patient/${e2e.patient.id}`);
      e2e.url = docRefFromWebhook.content?.[0].attachment?.url;
      expect(e2e.url).toBeTruthy();
      expect(isValidUrl(e2e.url)).toEqual(true);
    });

    test(`can download ${format} MR`, async () => {
      if (!e2e.url) return;
      const fileBuffer = await downloadToMemory({ url: e2e.url });
      expect(fileBuffer).toBeTruthy();
      e2e.mrContentBuffer = fileBuffer;
    });

    if (format === "json") {
      it("gets MR in json format with expected contents", async () => {
        if (!e2e.patient) throw new Error("Missing patient");
        const allergyId = e2e.allergyIntolerance?.id;
        if (!allergyId) throw new Error("Missing allergyIntolerance.id");
        const lastName = e2e.patient?.lastName;
        if (!lastName) throw new Error("Missing patient.lastName");
        const documentId = e2e.documentReference?.id;
        if (!documentId) throw new Error("Missing documentReference.id");
        const binaryId = e2e.binary?.id;
        if (!binaryId) throw new Error("Missing binary");
        const requestId = e2e.putConsolidatedDataRequestId;
        if (!requestId) throw new Error("Missing putConsolidatedDataRequestId");
        if (!e2e.mrContentBuffer) throw new Error("Missing mrContentBuffer");
        const contact = (
          Array.isArray(e2e.patient.contact)
            ? e2e.patient.contact
            : e2e.patient.contact
            ? [e2e.patient.contact]
            : []
        )[0];
        const phone = contact?.phone;
        if (!phone) throw new Error("Missing phone");
        const email = contact?.email;
        if (!email) throw new Error("Missing email");
        const contents = e2e.mrContentBuffer.toString("utf-8");
        expect(contents).toBeTruthy();
        expect(
          checkConsolidatedJson(contents, {
            cxId,
            patientId: e2e.patient.id,
            lastName,
            phone,
            email,
            allergyId,
            documentId,
            requestId,
            binaryId,
          })
        ).toBeTrue();
      });
    }

    if (format === "html") {
      it("gets MR in html format with expected contents", async () => {
        if (!e2e.patient) throw new Error("Missing patient");
        const lastName = e2e.patient?.lastName;
        if (!lastName) throw new Error("Missing patient.lastName");
        if (!e2e.mrContentBuffer) throw new Error("Missing mrContentBuffer");
        const allergyId = e2e.allergyIntolerance?.id;
        if (!allergyId) throw new Error("Missing allergyIntolerance.id");
        const contents = e2e.mrContentBuffer.toString("utf-8");
        expect(contents).toBeTruthy();
        expect(
          checkConsolidatedHtml({
            contents,
            patientId: e2e.patient.id,
            allergyId,
            lastName,
          })
        ).toBeTrue();
      });
    }

    if (format === "pdf") {
      it("gets MR in pdf format with expected contents", async () => {
        if (!e2e.mrContentBuffer) return;
        const fileType = detectFileType(e2e.mrContentBuffer);
        expect(fileType).toBeTruthy();
        expect(fileType.mimeType).toEqual(PDF_MIME_TYPE);
      });
    }

    it(`resets ${format} WH handler`, async () => {
      resetWebhook();
      expect(true).toBeTrue();
    });
  }

  /*************************************************************
   * Consolidated Query - Custom meta is sent with WH
   *************************************************************/

  it("triggers a conversion of consolidated with custom meta", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    e2e.expectedWebhookMeta = {
      prop1: faker.string.uuid(),
      prop2: faker.string.uuid(),
    };
    const conversionProgress = await medicalApi.startConsolidatedQuery(
      e2e.patient.id,
      undefined,
      undefined,
      undefined,
      "json",
      undefined,
      e2e.expectedWebhookMeta
    );
    expect(conversionProgress).toBeTruthy();
    expect(conversionProgress.status).toEqual("processing");
  });

  it("completes conversion successfully", async () => {
    await waitAndCheckConversion();
  });

  it("receives consolidated WH with custom meta", async () => {
    const whRequest = getConsolidatedWebhookRequest();
    expect(whRequest).toBeTruthy();
    if (!whRequest) throw new Error("Missing WH request");
    expect(whRequest.meta).toBeTruthy();
    expect(whRequest.meta.data).toBeTruthy();
    expect(whRequest.meta.data).toEqual(e2e.expectedWebhookMeta);
  });

  it("resets custom meta WH handler", async () => {
    resetWebhook();
    expect(true).toBeTrue();
  });

  /*************************************************************
   * Consolidated Query - Custom meta validation
   *************************************************************/

  it("fails if custom meta has +50 properties", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    e2e.expectedWebhookMeta = {};
    for (let i = 0; i < 51; i++) {
      e2e.expectedWebhookMeta[`prop${i}`] = faker.string.uuid();
    }
    expect(
      async () =>
        await medicalApi.startConsolidatedQuery(
          e2e.patient!.id,
          undefined,
          undefined,
          undefined,
          "json",
          undefined,
          e2e.expectedWebhookMeta
        )
    ).rejects.toThrow(AxiosError);
  });

  it("resets failed WH handler", async () => {
    resetWebhook();
    expect(true).toBeTrue();
  });

  /*************************************************************
   * Consolidated Query - Don't get WH when disabled
   *************************************************************/

  it("triggers a conversion with WHs disabled", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    e2e.expectedWebhookMeta = {
      disableWHFlag: "true",
    };
    const conversionProgress = await medicalApi.startConsolidatedQuery(
      e2e.patient.id,
      undefined,
      undefined,
      undefined,
      "json",
      undefined,
      e2e.expectedWebhookMeta
    );
    expect(conversionProgress).toBeTruthy();
    expect(conversionProgress.status).toEqual("processing");
  });

  it("completes conversion w/ disabled WH successfully", async () => {
    await waitAndCheckConversion();
  });

  it("does not receive consolidated WH when disabled WH", async () => {
    const whRequest = getConsolidatedWebhookRequest();
    expect(whRequest).toBeFalsy();
  });

  it("resets disabled WH handler", async () => {
    resetWebhook();
    expect(true).toBeTrue();
  });
}
