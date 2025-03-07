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
import {
  cxId,
  E2eContext,
  getAllergyIdOrFail,
  getBinaryIdOrFail,
  getConditionIdOrFail,
  getDocumentReferenceIdOrFail,
  getEncounterIdOrFail,
  getLocationIdOrFail,
  getPractitionerIdOrFail,
  getPutConsolidatedDataRequestIdOrFail,
  medicalApi,
} from "../shared";
import { getConsolidatedWebhookRequest, resetConsolidatedData } from "../webhook/consolidated";
import { checkWebhookRequestMeta } from "../webhook/shared";
import {
  checkConsolidatedHtml,
  checkConsolidatedJson,
  prepareConsolidatedTests,
} from "./consolidated/consolidated";

dayjs.extend(isBetween);
dayjs.extend(duration);

const conversionCheckStatusMaxRetries = 12;
const conversionCheckStatusWaitTime = dayjs.duration({ seconds: 10 });

export function runConsolidatedTests(e2e: E2eContext) {
  it("prepares consolidated", async () => {
    await prepareConsolidatedTests(e2e);
  });

  it("counts consolidated data", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    const expectedCount = getExpectedConsolidatedCount(e2e);
    await medicalApi.startConsolidatedQuery(e2e.patient.id);
    await waitAndCheckConversion();

    const whRequest = getConsolidatedWebhookRequest();
    checkWebhookRequestMeta(whRequest, "medical.consolidated-data");

    const count = await medicalApi.countPatientConsolidated(e2e.patient.id);
    expect(count.total).toEqual(expectedCount);
  });

  it("returns consolidated data", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    if (!e2e.consolidated?.bundle) throw new Error("Missing consolidatedPayload");
    const expectedContents = (e2e.consolidated?.bundle.entry ?? []).map(e =>
      expect.objectContaining({
        resource: expect.objectContaining({
          resourceType: e.resource?.resourceType,
          id: e.resource?.id,
        }),
      })
    );
    const expectedCount = getExpectedConsolidatedCount(e2e);
    const consolidated = await medicalApi.getPatientConsolidated(e2e.patient.id);
    expect(consolidated).toBeTruthy();
    const consolidatedWithoutPatient = consolidated?.entry?.filter(
      e => e.resource?.resourceType !== "Patient"
    );
    expect(consolidatedWithoutPatient).toBeTruthy();
    expect(consolidatedWithoutPatient?.length).toEqual(expectedCount - 1); // not including the patient
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
      if (!docRefFromWebhook) throw new Error("Missing DocumentReference");
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
        const lastName = e2e.patient?.lastName;
        if (!lastName) throw new Error("Missing patient.lastName");
        const allergyId = getAllergyIdOrFail(e2e);
        const conditionId = getConditionIdOrFail(e2e);
        const encounterId = getEncounterIdOrFail(e2e);
        const locationId = getLocationIdOrFail(e2e);
        const practitionerId = getPractitionerIdOrFail(e2e);
        const documentId = getDocumentReferenceIdOrFail(e2e);
        const binaryId = getBinaryIdOrFail(e2e);
        const requestId = getPutConsolidatedDataRequestIdOrFail(e2e);
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
            conditionId,
            encounterId,
            documentId,
            requestId,
            locationId,
            practitionerId,
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
        const allergyId = getAllergyIdOrFail(e2e);
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
      resetWebhook(e2e);
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
    resetWebhook(e2e);
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
    resetWebhook(e2e);
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
    resetWebhook(e2e);
    expect(true).toBeTrue();
  });

  /*************************************************************
   * Consolidated Query - Don't get WH when fromDashboard is true
   *************************************************************/

  it("does not send WH if fromDashboard is true", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    const conversionProgress = await medicalApi.startConsolidatedQuery(
      e2e.patient.id,
      undefined,
      undefined,
      undefined,
      "json",
      true
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
    resetWebhook(e2e);
    expect(true).toBeTrue();
  });
}

function resetWebhook(e2e: E2eContext) {
  resetConsolidatedData();
  e2e.url = undefined;
  e2e.mrContentBuffer = undefined;
  e2e.expectedWebhookMeta = undefined;
}

function getExpectedConsolidatedCount(e2e: E2eContext) {
  const consolidatedCount = e2e.consolidated?.bundle.entry?.length ?? 0;
  const contributedCount = e2e.contributed?.documentReference ? 1 : 0;
  const patientCount = 1;
  const expectedCount = consolidatedCount + patientCount + contributedCount;
  return expectedCount;
}
