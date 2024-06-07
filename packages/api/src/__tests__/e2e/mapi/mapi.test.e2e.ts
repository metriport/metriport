import { faker } from "@faker-js/faker";
import { OperationOutcomeError } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { Facility, Organization, PatientDTO } from "@metriport/api-sdk";
import { isDocumentReference } from "@metriport/core/external/fhir/document/document-reference";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";
import { downloadToMemory, isValidUrl, sleep } from "@metriport/shared";
import assert from "assert";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import fs from "fs";
import { validate as validateUuid } from "uuid";
import { areDocumentsProcessing } from "../../../command/medical/document/document-status";
import { checkConsolidatedHtml, createConsolidated } from "./consolidated/consolidated";
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
import { getConsolidatedWebhookRequest } from "./webhook/consolidated";
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

jest.setTimeout(maxTotalTestDuration.asMilliseconds());

beforeAll(async () => {
  await initMapiE2e();
});
afterAll(async () => {
  await tearDownMapiE2e();
});

describe("MAPI E2E Tests", () => {
  let facility: Facility;
  let patient: PatientDTO;
  let patientFhir: PatientWithId;
  let consolidatedPayload: Bundle<Resource>;
  let url: string | undefined;

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
    const foundFacility = await medicalApi.getFacility(facility.id);
    validateFacility(foundFacility);
  });

  it("updates a facility", async () => {
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

  it("creates consolidated data", async () => {
    consolidatedPayload = createConsolidated(patientFhir);
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
      fs.writeFileSync("consolidated-received.json", JSON.stringify(consolidated, null, 2));
      fs.writeFileSync("consolidated-expected.json", JSON.stringify(consolidatedPayload, null, 2));
      throw err;
    }
  });

  it("awaits data to be replicated to FHIR server", async () => {
    await sleep(waitTimeAfterPutConsolidated.asMilliseconds());
  });

  it("counts consolidated data", async () => {
    const count = await medicalApi.countPatientConsolidated(patient.id);
    expect(count.total).toEqual(consolidatedPayload.entry?.length);
  });

  it("returns consolidated data", async () => {
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

  it("triggers a conversion of consolidated into HTML format", async () => {
    const conversionProgress = await medicalApi.startConsolidatedQuery(
      patient.id,
      undefined,
      undefined,
      undefined,
      "html"
    );
    expect(conversionProgress).toBeTruthy();
    expect(conversionProgress.status).toEqual("processing");
  });

  it("completes conversion successfully", async () => {
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
  });

  it("received WH with correct meta", async () => {
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

  it("received WH with MR in HTML format", async () => {
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
                  contentType: "application/html",
                }),
              }),
            ]),
          }),
        }),
      ])
    );
    const resource = bundle.entry?.[0]?.resource;
    if (!resource || resource.resourceType !== "DocumentReference") {
      throw new Error("Missing DocumentReference");
    }
    const patientRef = resource.subject?.reference;
    expect(patientRef).toBeTruthy();
    expect(patientRef).toEqual(`Patient/${patient.id}`);
    url = resource.content?.[0].attachment?.url;
    expect(url).toBeTruthy();
    expect(isValidUrl(url)).toEqual(true);
  });

  test("MR in HTML format has expected contents", async () => {
    if (!url) return;
    const fileBuffer = await downloadToMemory({ url });
    expect(fileBuffer).toBeTruthy();
    const contents = fileBuffer.toString("utf-8");
    expect(contents).toBeTruthy();
    expect(
      checkConsolidatedHtml({
        html: contents,
        patientId: patient.id,
      })
    ).toBeTrue();
  });

  it.skip("gets MR in PDF format", async () => {
    // TODO 1634 implement this
    // needs WH server
    // const startResp = await medicalApi.startConsolidatedQuery(
    //   patient.id,
    //   undefined,
    //   undefined,
    //   undefined,
    //   "html"
    // );
    // expect(startResp).toBeTruthy();
    // expect(startResp.status).toEqual("processing");
    // const startTime = Date.now();
    // while (Date.now() - startTime < 10_000) {
    //   if (wasItCalled()) {
    //     console.log("Webhook was called");
    //   } else {
    //     console.log("Webhook was NOT called, sleeping...");
    //   }
    //   await sleep(500);
    // }
  });

  it("triggers a document query", async () => {
    const docQueryProgress = await medicalApi.startDocumentQuery(patient.id, facility.id);
    expect(docQueryProgress).toBeTruthy();
    expect(areDocumentsProcessing(docQueryProgress)).toBeTruthy();
  });

  it("gets successful response from document query", async () => {
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
    // when moved to internal will updated
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
    await Promise.all([medicalApi.deletePatient(patient.id, facility.id)]);
    await sleep(100);
    expect(async () => getPatient(patient.id)).rejects.toThrow(
      "Request failed with status code 404"
    );
    expect(async () => getFhirPatient(patient.id)).rejects.toThrowError(OperationOutcomeError);
  });

  it("deletes the facility", async () => {
    await medicalApi.deleteFacility(facility.id);
    try {
      await medicalApi.getFacility(facility.id);
      assert.fail("It should have failed to get the facility after deletion");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      expect(error).toBeTruthy();
      expect(error.response?.status).toEqual(404);
    }
  });
});
