/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { OperationOutcomeError } from "@medplum/core";
import {
  AllergyIntolerance,
  Binary,
  Bundle,
  DocumentReference,
  Resource,
} from "@medplum/fhirtypes";
import { Facility, Organization, PatientDTO } from "@metriport/api-sdk";
import { isDocumentReference } from "@metriport/core/external/fhir/document/document-reference";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";
import { detectFileType } from "@metriport/core/util/file-type";
import { PDF_MIME_TYPE } from "@metriport/core/util/mime";
import { downloadToMemory, isValidUrl, sleep } from "@metriport/shared";
import { AxiosError } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import fs from "fs";
import { validate as validateUuid } from "uuid";
import { areDocumentsProcessing } from "../../../command/medical/document/document-status";
import { e2eResultsFolderName } from "../shared";
import {
  checkConsolidatedHtml,
  checkConsolidatedJson,
  createConsolidatedPayloads,
} from "./consolidated/consolidated";
import { createFacility, validateFacility } from "./facility";
import { initMapiE2e, tearDownMapiE2e } from "./init";
import { validateFhirOrg, validateLocalOrg } from "./organization";
import {
  createPatient,
  patientDtoToFhir,
  validateFhirPatient,
  validateLocalPatient,
} from "./patient";
import { fhirApi, fhirHeaders, medicalApi } from "./shared";
import { getConsolidatedWebhookRequest, resetConsolidatedData } from "./webhook/consolidated";
import { getPingWebhookRequest } from "./webhook/settings";
import whServer from "./webhook/webhook-server";

dayjs.extend(isBetween);
dayjs.extend(duration);

const maxTotalTestDuration = dayjs.duration({ minutes: 12 });

const waitTimeBetweenPdAndDq = dayjs.duration({ seconds: 1 }); // not much needed, we schedule DQ if PD still in progress

const waitTimeAfterPutConsolidated = dayjs.duration({ seconds: 1 });

const dqCheckStatusMaxRetries = 30;
const dqCheckStatusWaitTime = dayjs.duration({ seconds: 10 });

const conversionCheckStatusMaxRetries = 12;
const conversionCheckStatusWaitTime = dayjs.duration({ seconds: 10 });

const pingWebhookCheckMaxRetries = 5;
const pingWebhookCheckStatusWaitTime = dayjs.duration({ seconds: 2 });

jest.setTimeout(maxTotalTestDuration.asMilliseconds());

beforeAll(async () => {
  await initMapiE2e();
});
afterAll(async () => {
  await tearDownMapiE2e();
});

describe("MAPI E2E Tests", () => {
  let facility: Facility | undefined;
  let patient: PatientDTO | undefined;
  let patientFhir: PatientWithId | undefined;
  let consolidatedPayload: Bundle<Resource> | undefined;
  let allergyIntolerance: AllergyIntolerance;
  let documentReference: DocumentReference;
  let binary: Binary | undefined;
  let url: string | undefined;
  let mrContentBuffer: Buffer | undefined;
  let expectedWebhookMeta: Record<string, string> | undefined;

  const getOrg = async () => {
    return await medicalApi.getOrganization();
  };

  const getFhirOrg = async (org: { id: string }) => {
    fhirApi.invalidateAll();
    return await fhirApi.readResource("Organization", org.id, fhirHeaders);
  };

  const getPatient = async (patientId: string): Promise<PatientDTO> => {
    return await medicalApi.getPatient(patientId);
  };

  const getFhirPatient = async (patientId: string) => {
    fhirApi.invalidateAll();
    return await fhirApi.readResource("Patient", patientId, fhirHeaders);
  };

  /*************************************************************
   * Settings
   *************************************************************/

  it("gets settings", async () => {
    const settings = await medicalApi.getSettings();
    expect(settings).toBeTruthy();
  });

  it("updates settings", async () => {
    const whUrl = whServer.getWebhookServerUrl();
    const updateResp = await medicalApi.updateSettings(whUrl);
    expect(updateResp).toBeTruthy();
    expect(updateResp.webhookUrl).toEqual(whUrl);
    expect(updateResp.webhookKey).toBeTruthy();
    const settings = await medicalApi.getSettings();
    expect(settings).toBeTruthy();
    expect(settings.webhookUrl).toBeTruthy();
    expect(settings.webhookUrl).toEqual(whUrl);
    whServer.storeWebhookKey(updateResp.webhookKey);
  });

  it("receives ping WH request", async () => {
    let retryLimit = 0;
    let whRequest = getPingWebhookRequest();
    while (!whRequest && retryLimit++ < pingWebhookCheckMaxRetries) {
      console.log(
        `Waiting for ping, retrying in ${pingWebhookCheckStatusWaitTime.asSeconds()} seconds...`
      );
      await sleep(pingWebhookCheckStatusWaitTime.asMilliseconds());
      whRequest = getPingWebhookRequest();
    }
    expect(whRequest).toBeTruthy();
  });

  it("receives ping WH with correct data", async () => {
    const whRequest = getPingWebhookRequest();
    expect(whRequest).toBeTruthy();
    if (!whRequest) throw new Error("Missing WH request");
    expect(whRequest.meta).toBeTruthy();
    expect(whRequest.meta).toEqual(
      expect.objectContaining({
        type: "ping",
        messageId: expect.anything(),
        when: expect.anything(),
      })
    );
    expect(validateUuid(whRequest.meta.messageId)).toBeTrue();
    const minDate = dayjs().subtract(1, "minute").toDate();
    const maxDate = dayjs().add(1, "minute").toDate();
    expect(dayjs(whRequest.meta.when).isBetween(minDate, maxDate)).toBeTrue();
    expect(whRequest.meta).not.toEqual(
      expect.objectContaining({
        data: expect.toBeFalsy,
      })
    );
    expect(whRequest.ping).toBeTruthy();
    expect(whRequest.ping.length).toEqual(21); // default nanoid length
  });

  /*************************************************************
   * MAPI Starts
   *************************************************************/

  it("gets an organization", async () => {
    const org = await medicalApi.getOrganization();
    expect(org).toBeTruthy();
    if (!org) throw new Error("Organization not found");
    validateLocalOrg(org);
    const fhirOrg = await getFhirOrg(org);
    validateFhirOrg(fhirOrg, org);
  });

  it("updates an organization", async () => {
    const org = await medicalApi.getOrganization();
    expect(org).toBeTruthy();
    if (!org) throw new Error("Organization not found");

    const newName = faker.word.noun();
    const updateOrg: Organization = {
      ...org,
      name: newName,
    };
    const updateOrgResp = await medicalApi.updateOrganization(updateOrg);
    expect(updateOrgResp.name).toEqual(newName);

    await sleep(100);

    const [updatedOrg, fhirOrg] = await Promise.all([getOrg(), getFhirOrg(org)]);

    expect(updatedOrg).toBeTruthy();
    if (!updatedOrg) throw new Error("Updated organization not found");
    expect(updatedOrg.name).toEqual(newName);
    expect(fhirOrg.name).toEqual(newName);
  });

  it("creates a facility", async () => {
    facility = await medicalApi.createFacility(createFacility);
    validateFacility(facility);
  });

  it("gets a facility", async () => {
    if (!facility) throw new Error("Missing facility");
    const foundFacility = await medicalApi.getFacility(facility.id);
    validateFacility(foundFacility);
  });

  it("updates a facility", async () => {
    if (!facility) throw new Error("Missing facility");
    const newName = faker.word.noun();
    const updateFacility: Facility = {
      ...facility,
      name: newName,
    };
    const updatedFacility = await medicalApi.updateFacility(updateFacility);
    facility = await medicalApi.getFacility(facility.id);
    expect(facility.name).toEqual(newName);
    expect(updatedFacility.name).toEqual(newName);
  });

  it("creates and gets the patient", async () => {
    if (!facility) throw new Error("Missing facility");
    patient = await medicalApi.createPatient(createPatient, facility.id);
    patientFhir = patientDtoToFhir(patient);
    await sleep(100);
    const [createdPatient, fhirPatient] = await Promise.all([
      getPatient(patient.id),
      getFhirPatient(patient.id),
    ]);
    validateLocalPatient(createdPatient, patient);
    validateFhirPatient(fhirPatient, patient);
  });

  it("awaits patient update to be replicated", async () => {
    // Creating a CW patient is done in the background need to await so we can query docs
    await sleep(waitTimeBetweenPdAndDq.asMilliseconds());
  });

  /*************************************************************
   * Add Consolidated Data
   *************************************************************/

  function createAndStoreConsolidatedData() {
    if (!patientFhir) throw new Error("Missing patientFhir");
    const payloads = createConsolidatedPayloads(patientFhir);
    consolidatedPayload = payloads.consolidated;
    allergyIntolerance = payloads.allergyIntolerance;
    documentReference = payloads.documentReference;
    binary = payloads.binary;
  }

  it("creates consolidated data", async () => {
    if (!patient) throw new Error("Missing patient");
    createAndStoreConsolidatedData();
    if (!consolidatedPayload) throw new Error("Missing consolidatedPayload");
    const consolidated = await medicalApi.createPatientConsolidated(
      patient.id,
      consolidatedPayload
    );
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
        JSON.stringify(consolidatedPayload, null, 2)
      );
      throw err;
    }
  });

  it("awaits data to be replicated to FHIR server", async () => {
    await sleep(waitTimeAfterPutConsolidated.asMilliseconds());
  });

  it("counts consolidated data", async () => {
    if (!patient) throw new Error("Missing patient");
    if (!consolidatedPayload) throw new Error("Missing consolidatedPayload");
    const count = await medicalApi.countPatientConsolidated(patient.id);
    expect(count.total).toEqual(consolidatedPayload.entry?.length);
  });

  it("returns consolidated data", async () => {
    if (!patient) throw new Error("Missing patient");
    if (!consolidatedPayload) throw new Error("Missing consolidatedPayload");
    const consolidated = await medicalApi.getPatientConsolidated(patient.id);
    expect(consolidated).toBeTruthy();
    const consolidatedWithoutPatient = consolidated?.entry?.filter(
      e => e.resource?.resourceType !== "Patient"
    );
    const expectedContents = (consolidatedPayload?.entry ?? []).map(e =>
      expect.objectContaining({
        resource: expect.objectContaining({
          resourceType: e.resource?.resourceType,
          id: e.resource?.id,
        }),
      })
    );
    expect(consolidatedWithoutPatient).toBeTruthy();
    expect(consolidatedWithoutPatient?.length).toEqual(consolidatedPayload.entry?.length);
    expect(consolidatedWithoutPatient).toEqual(expect.arrayContaining(expectedContents));
  });

  /*************************************************************
   * Consolidated Query
   *************************************************************/

  function resetWebhook() {
    resetConsolidatedData();
    url = undefined;
    mrContentBuffer = undefined;
    expectedWebhookMeta = undefined;
  }

  async function waitAndCheckConversion(): Promise<void> {
    if (!patient) throw new Error("Missing patient");
    let conversionProgresses = await medicalApi.getConsolidatedQueryStatus(patient.id);
    let initConversionProgress = conversionProgresses?.queries?.[0];
    let retryLimit = 0;
    while (
      initConversionProgress?.status !== "completed" &&
      retryLimit++ < conversionCheckStatusMaxRetries
    ) {
      console.log(
        `Conversion still processing, retrying in ${conversionCheckStatusWaitTime.asSeconds()} seconds...`
      );
      await sleep(conversionCheckStatusWaitTime.asMilliseconds());
      conversionProgresses = await medicalApi.getConsolidatedQueryStatus(patient.id);
      initConversionProgress = conversionProgresses?.queries?.[0];
    }
    expect(conversionProgresses).toBeTruthy();
    expect(initConversionProgress?.status).toEqual("completed");
  }

  for (const format of ["json", "html", "pdf"]) {
    it(`triggers a conversion of consolidated into ${format} format`, async () => {
      if (!patient) throw new Error("Missing patient");
      const conversionProgress = await medicalApi.startConsolidatedQuery(
        patient.id,
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
      expect(whRequest).toBeTruthy();
      if (!whRequest) throw new Error("Missing WH request");
      expect(whRequest.meta).toBeTruthy();
      expect(whRequest.meta).toEqual(
        expect.objectContaining({
          type: "medical.consolidated-data",
          messageId: expect.anything(),
          when: expect.anything(),
        })
      );
      expect(validateUuid(whRequest.meta.messageId)).toBeTrue();
      const minDate = dayjs().subtract(1, "minute").toDate();
      const maxDate = dayjs().add(1, "minute").toDate();
      expect(dayjs(whRequest.meta.when).isBetween(minDate, maxDate)).toBeTrue();
      expect(whRequest.meta).not.toEqual(
        expect.objectContaining({
          data: expect.toBeFalsy,
        })
      );
    });

    it(`receives consolidated ${format} WH with MR in ${format} format`, async () => {
      if (!patient) throw new Error("Missing patient");
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
      expect(patientRef).toEqual(`Patient/${patient.id}`);
      url = docRefFromWebhook.content?.[0].attachment?.url;
      expect(url).toBeTruthy();
      expect(isValidUrl(url)).toEqual(true);
    });

    test(`can download ${format} MR`, async () => {
      if (!url) return;
      const fileBuffer = await downloadToMemory({ url });
      expect(fileBuffer).toBeTruthy();
      mrContentBuffer = fileBuffer;
    });

    if (format === "json") {
      it("gets MR in json format with expected contents", async () => {
        if (!patient) throw new Error("Missing patient");
        const allergyId = allergyIntolerance?.id;
        if (!allergyId) throw new Error("Missing allergyIntolerance.id");
        const documentId = documentReference?.id;
        if (!documentId) throw new Error("Missing documentReference.id");
        const binaryId = binary?.id;
        if (!binaryId) throw new Error("Missing binary");
        if (!mrContentBuffer) throw new Error("Missing mrContentBuffer");
        const contents = mrContentBuffer.toString("utf-8");
        const contact = (
          Array.isArray(patient.contact)
            ? patient.contact
            : patient.contact
            ? [patient.contact]
            : []
        )[0];
        const phone = contact?.phone;
        if (!phone) throw new Error("Missing phone");
        const email = contact?.email;
        if (!email) throw new Error("Missing email");
        expect(contents).toBeTruthy();
        expect(
          checkConsolidatedJson({
            contents,
            patientId: patient.id,
            phone,
            email,
            allergyId,
            documentId,
            binaryId,
          })
        ).toBeTrue();
      });
    }

    if (format === "html") {
      it("gets MR in html format with expected contents", async () => {
        if (!patient) throw new Error("Missing patient");
        if (!mrContentBuffer) throw new Error("Missing mrContentBuffer");
        const contents = mrContentBuffer.toString("utf-8");
        expect(contents).toBeTruthy();
        expect(
          checkConsolidatedHtml({
            contents,
            patientId: patient.id,
          })
        ).toBeTrue();
      });
    }

    if (format === "pdf") {
      it("gets MR in pdf format with expected contents", async () => {
        if (!mrContentBuffer) return;
        const fileType = detectFileType(mrContentBuffer);
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
    if (!patient) throw new Error("Missing patient");
    expectedWebhookMeta = {
      prop1: faker.string.uuid(),
      prop2: faker.string.uuid(),
    };
    const conversionProgress = await medicalApi.startConsolidatedQuery(
      patient.id,
      undefined,
      undefined,
      undefined,
      "json",
      expectedWebhookMeta
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
    expect(whRequest.meta.data).toEqual(expectedWebhookMeta);
  });

  it("resets custom meta WH handler", async () => {
    resetWebhook();
    expect(true).toBeTrue();
  });

  /*************************************************************
   * Consolidated Query - Custom meta validation
   *************************************************************/

  it("fails if custom meta has +50 properties", async () => {
    if (!patient) throw new Error("Missing patient");
    expectedWebhookMeta = {};
    for (let i = 0; i < 51; i++) {
      expectedWebhookMeta[`prop${i}`] = faker.string.uuid();
    }
    expect(
      async () =>
        await medicalApi.startConsolidatedQuery(
          patient!.id,
          undefined,
          undefined,
          undefined,
          "json",
          expectedWebhookMeta
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
    if (!patient) throw new Error("Missing patient");
    expectedWebhookMeta = {
      disableWHFlag: "true",
    };
    const conversionProgress = await medicalApi.startConsolidatedQuery(
      patient.id,
      undefined,
      undefined,
      undefined,
      "json",
      expectedWebhookMeta
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

  /*************************************************************
   * Document Query
   *************************************************************/

  it("triggers a document query", async () => {
    if (!patient) throw new Error("Missing patient");
    if (!facility) throw new Error("Missing facility");
    const docQueryProgress = await medicalApi.startDocumentQuery(patient.id, facility.id);
    expect(docQueryProgress).toBeTruthy();
    expect(areDocumentsProcessing(docQueryProgress)).toBeTruthy();
  });

  it("gets successful response from document query", async () => {
    if (!patient) throw new Error("Missing patient");
    const expectedDocRefs = (consolidatedPayload?.entry ?? []).flatMap(e =>
      e.resource && isDocumentReference(e.resource) ? e.resource : []
    );
    let status = await medicalApi.getDocumentQueryStatus(patient.id);
    let retryLimit = 0;
    while (areDocumentsProcessing(status) && retryLimit++ < dqCheckStatusMaxRetries) {
      console.log(
        `Document query still processing, retrying in ${dqCheckStatusWaitTime.asSeconds} seconds...`
      );
      await sleep(dqCheckStatusWaitTime.asMilliseconds());
      status = await medicalApi.getDocumentQueryStatus(patient.id);
    }
    const { documents } = await medicalApi.listDocuments(patient.id);
    expect(documents).toBeTruthy();
    expect(documents.length).toEqual(expectedDocRefs.length);
    // TODO 1634 compare documents vs. expectedDocRefs
  });

  it("contains expected data on FHIR server", async () => {
    // TODO 1634 implement this
    // do we need a dedicated one for MR's data or does it come from consolidated?
  });

  it("deletes a patient's consolidated data", async () => {
    if (!patient) throw new Error("Missing patient");
    const consolidated = await medicalApi.getPatientConsolidated(patient.id);
    if (consolidated && consolidated.entry) {
      for (const docEntry of consolidated.entry) {
        if (docEntry.resource && docEntry.resource.id) {
          await fhirApi.deleteResource(
            docEntry.resource.resourceType,
            docEntry.resource.id,
            fhirHeaders
          );
        }
      }
    }
    const count = await medicalApi.countPatientConsolidated(patient.id);
    expect(count.total).toEqual(0);
  });

  it("deletes the patients", async () => {
    if (!patient) throw new Error("Missing patient");
    if (!facility) throw new Error("Missing facility");
    await medicalApi.deletePatient(patient.id, facility.id);
    await sleep(100);
    expect(async () => getPatient(patient!.id)).rejects.toThrow(
      "Request failed with status code 404"
    );
    expect(async () => getFhirPatient(patient!.id)).rejects.toThrowError(OperationOutcomeError);
  });

  it("deletes the facility", async () => {
    if (!facility) throw new Error("Missing facility");
    await medicalApi.deleteFacility(facility.id);
    expect(async () => medicalApi.getFacility(patient!.id)).rejects.toThrow(
      "Request failed with status code 404"
    );
  });
});
