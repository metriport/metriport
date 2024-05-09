import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { faker } from "@faker-js/faker";
import { OperationOutcomeError } from "@medplum/core";
import { Facility, Organization, PatientDTO } from "@metriport/api-sdk";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createFacility, validateFacility } from "./facility";
import { validateFhirOrg, validateLocalOrg } from "./organization";
import { createPatient, validateFhirPatient, validateLocalPatient } from "./patient";
import { fhirApi, fhirHeaders, medicalApi } from "./shared";

dayjs.extend(duration);

// const maxRetries = 4;
// const maxRetries = 0;
const maxTotalTestDuration = dayjs.duration({ minutes: 2 });

jest.setTimeout(maxTotalTestDuration.asMilliseconds());

describe("MAPI E2E Tests", () => {
  let facility: Facility;
  let patient: PatientDTO;

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

  describe("Organization", () => {
    const getOrg = async () => {
      return await medicalApi.getOrganization();
    };

    const getFhirOrg = async (org: { id: string }) => {
      fhirApi.invalidateAll();
      return await fhirApi.readResource("Organization", org.id, fhirHeaders);
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
  });

  describe("Facility", () => {
    it("create a facility", async () => {
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
  });

  describe("Patient", () => {
    const getPatient = async (patientId: string): Promise<PatientDTO> => {
      return await medicalApi.getPatient(patientId);
    };

    const getFhirPatient = async (patientId: string) => {
      fhirApi.invalidateAll();
      return await fhirApi.readResource("Patient", patientId, fhirHeaders);
    };

    it("creates and gets the patient", async () => {
      patient = await medicalApi.createPatient(createPatient, facility.id);
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
      await sleep(10000);
    });

    it("deletes the patient", async () => {
      await medicalApi.deletePatient(patient.id, facility.id);
      await sleep(100);
      expect(async () => getPatient(patient.id)).rejects.toThrow(
        "Request failed with status code 404"
      );
      expect(async () => getFhirPatient(patient.id)).rejects.toThrowError(OperationOutcomeError);
    });
  });

  // it("creates consolidated data for patient", async () => {
  //   const payload = createConsolidated(patient.id);
  //   const consolidated = await medicalApi.createPatientConsolidated(patient.id, payload);
  //   const count = await medicalApi.countPatientConsolidated(patient.id);

  //   expect(count.total).toEqual(payload.entry?.length);
  //   expect(consolidated).toBeTruthy();
  // });

  // it("triggers a document query for the created patient", async () => {
  //   const docQueryProgress = await medicalApi.startDocumentQuery(patient.id, facility.id);
  //   let status = await medicalApi.getDocumentQueryStatus(patient.id);
  //   let retryLimit = 0;

  //   while (areDocumentsProcessing(status) && retryLimit < maxRetries) {
  //     await sleep(5000);
  //     status = await medicalApi.getDocumentQueryStatus(patient.id);
  //     retryLimit++;
  //   }

  //   const { documents } = await medicalApi.listDocuments(patient.id);

  //   expect(docQueryProgress).toBeTruthy();
  //   expect(documents).toBeTruthy();
  //   expect(documents.length).toEqual(2);
  // });

  // it("contains expected data on FHIR server", async () => {
  //   // TODO implement this
  //   // do we need a dedicated one for MR's data or does it come from consolidated?
  // });

  // it("creates consolidated data for patient", async () => {
  //   const payload = createConsolidated(patient.id);
  //   const consolidated = await medicalApi.createPatientConsolidated(patient.id, payload);
  //   const count = await medicalApi.countPatientConsolidated(patient.id);

  //   expect(count.total).toEqual(payload.entry?.length);
  //   expect(consolidated).toBeTruthy();
  // });

  // it("deletes a patient's consolidated data", async () => {
  //   // when moved to internal will updated
  //   const consolidated = await medicalApi.getPatientConsolidated(patient.id);

  //   if (consolidated && consolidated.entry) {
  //     for (const docEntry of consolidated.entry) {
  //       if (docEntry.resource && docEntry.resource.id) {
  //         await fhirApi.deleteResource(
  //           docEntry.resource.resourceType,
  //           docEntry.resource.id,
  //           fhirHeaders
  //         );
  //       }
  //     }
  //   }

  //   const count = await medicalApi.countPatientConsolidated(patient.id);

  //   expect(count.total).toEqual(0);
  // });
});
