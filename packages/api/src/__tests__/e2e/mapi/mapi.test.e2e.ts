import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { faker } from "@faker-js/faker";
import { OperationOutcomeError } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { Facility, Organization, PatientDTO } from "@metriport/api-sdk";
import { isDocumentReference } from "@metriport/core/external/fhir/document/document-reference";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";
import { sleep } from "@metriport/shared";
import assert from "assert";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { areDocumentsProcessing } from "../../../command/medical/document/document-status";
import { createConsolidated } from "./consolidated";
import { createFacility, validateFacility } from "./facility";
import { validateFhirOrg, validateLocalOrg } from "./organization";
import {
  createPatient,
  patientDtoToFhir,
  validateFhirPatient,
  validateLocalPatient,
} from "./patient";
import { fhirApi, fhirHeaders, medicalApi } from "./shared";
import { Config } from "../../../shared/config";

dayjs.extend(duration);

const maxTotalTestDuration = dayjs.duration({ minutes: 12 });

const waitTimeBetweenPdAndDq = dayjs.duration({ seconds: 1 }); // not much needed, we schedule DQ if PD still in progress

const dqCheckStatusMaxRetries = 30;
const dqCheckStatusWaitTime = dayjs.duration({ seconds: 10 });

const conversionCheckStatusMaxRetries = 12;
const conversionCheckStatusWaitTime = dayjs.duration({ seconds: 10 });

jest.setTimeout(maxTotalTestDuration.asMilliseconds());

describe("MAPI E2E Tests", () => {
  let facility: Facility;
  let patient: PatientDTO;
  let patientFhir: PatientWithId;
  let consolidatedPayload: Bundle<Resource>;

  // TODO 1634 To be used when we're ready to add additional tests checking updates on HIEs...
  // ...this will need customization on external endpoints to return additional patient IDs.
  // let isCwEnabled = false;
  // let isCqEnabled = false;

  // beforeAll(async () => {
  //   const [_isCwEnabled, _isCqEnabled] = await Promise.all([
  //     isCWEnabledForCx(testCxId),
  //     isCQDirectEnabledForCx(testCxId),
  //   ]);
  //   isCwEnabled = _isCwEnabled;
  //   isCqEnabled = _isCqEnabled;
  // });

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

  // const getCwOrg = async (org: { oid: string }) => {
  //   if (!isCwEnabled) return undefined;
  //   return await cwCommands.organization.get(org.oid);
  // };

  // const getCqOrg = async (org: { oid: string }) => {
  //   if (!isCqEnabled) return undefined;
  //   return await getCqOrganization(org.oid);
  // };

  it("gets an organization", async () => {
    const org = await medicalApi.getOrganization();
    expect(org).toBeTruthy();
    if (!org) throw new Error("Organization not found");
    validateLocalOrg(org);

    // const [fhirOrg, cwOrg, cqOrg] = await Promise.all([
    const [fhirOrg] = await Promise.all([
      getFhirOrg(org),
      // getCwOrg(org),
      // getCqOrg(org),
    ]);

    validateFhirOrg(fhirOrg, org);
    // isCwEnabled && validateCwOrg(cwOrg, org);
    // // TODO 1634 Consider whether we can have our test org on the CQ directory, then we can re-enable this after we publish our test org there
    // false && isCqEnabled && validateCqOrg(cqOrg, org);
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

    // const [updatedOrg, fhirOrg, cwOrg, cqOrg] = await Promise.all([
    const [updatedOrg, fhirOrg] = await Promise.all([
      getOrg(),
      getFhirOrg(org),
      // getCwOrg(org),
      // getCqOrg(org),
    ]);

    expect(updatedOrg).toBeTruthy();
    if (!updatedOrg) throw new Error("Updated organization not found");
    expect(updatedOrg.name).toEqual(newName);
    expect(fhirOrg.name).toEqual(newName);
    // isCwEnabled && expect(cwOrg?.name).toEqual(newName);
    // // TODO 1634 Consider whether we can have our test org on the CQ directory, then we can re-enable this after we publish our test org there
    // false && isCqEnabled && expect(cqOrg?.name).toEqual(newName);
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
    // TODO 1634 compare consolidated vs. consolidatedPayload
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
    let conversionProgress = await medicalApi.getConsolidatedQueryStatus(patient.id);
    let retryLimit = 0;
    while (
      conversionProgress.status !== "completed" &&
      retryLimit++ < conversionCheckStatusMaxRetries
    ) {
      console.log(
        `Conversion still processing, retrying in ${conversionCheckStatusWaitTime.asSeconds} seconds...`
      );
      await sleep(conversionCheckStatusWaitTime.asMilliseconds());
      conversionProgress = await medicalApi.getConsolidatedQueryStatus(patient.id);
    }
    expect(conversionProgress).toBeTruthy();
    expect(conversionProgress.status).toEqual("completed");
  });

  it.skip("gets MR in HTML format", async () => {
    // TODO 1634 implement this
    // needs WH server
  });

  it.skip("gets MR in PDF format", async () => {
    // TODO 1634 implement this
    // needs WH server
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

  // TODO 1634 Remove this
  // TODO 1634 Remove this
  // TODO 1634 Remove this
  // TODO 1634 Remove this
  if (Config.isDev()) {
    it("deletes the facility", async () => {
      await medicalApi.deleteFacility(facility.id);
      try {
        await medicalApi.getFacility(facility.id);
        assert.fail("It should have failed to get the facility after deletion");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.log("Error:", error);
        expect(error).toBeTruthy();
        expect(error.response?.status).toEqual(404);
      }
    });
  }
});
