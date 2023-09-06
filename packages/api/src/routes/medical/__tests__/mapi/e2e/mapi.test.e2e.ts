import * as dotenv from "dotenv";
dotenv.config();

import { MetriportMedicalApi, Organization, Facility, Patient } from "@metriport/api-sdk";
import { Organization as CWOrganization } from "@metriport/commonwell-sdk";
import { Organization as FhirOrg } from "@medplum/fhirtypes";
import { faker } from "@faker-js/faker";
// import { AxiosInstance } from "axios";
import { FhirClient } from "../../../../../external/fhir/api/api";
import { ResourceType } from "../../../../../external/fhir/shared";
import cwCommands from "../../../../../external/commonwell/__tests__";
// import { Account } from "./account";
import { validateCWOrg, validateFhirOrg, validateLocalOrg } from "./organization";
import { createFacility, validateFacility } from "./facility";
import { createPatient, validateFhirPatient, validateLocalPatient } from "./patient";
import { createConsolidated } from "./consolidated";
import { setupE2ETest, retryFunction, fhirHeaders } from "./shared";
import { Util } from "../../../../../shared/util";
import { Config } from "../../../../../shared/config";

// Cant delete cw org so we need a test org to increment the id to avoid conflicts
// TODO: #1022 - TO BE USED WHEN ABLE TO HIT INTERNAL IN GITHUB RUNNER
// const INCREMENT_ORG_ID = process.env.TEST_ORG_ID || "";
// const ORGANIZATION = "/internal/organization";
// const FACILITY = "/internal/facility";
// const PATIENT = "/internal/patient";
const maxRetries = 4;

jest.setTimeout(30000);

// NEVER TO BE RUN IN PRODUCTION
if (Config.isStaging() || !Config.isCloudEnv()) {
  describe("MAPI E2E Tests", () => {
    // let account: Account;
    let medicalApi: MetriportMedicalApi;
    let fhirApi: FhirClient;
    // let apiOSS: AxiosInstance;

    // let org: Organization;
    let facility: Facility;
    let patient: Patient;

    beforeAll(async () => {
      const setup = await setupE2ETest();

      // account = setup.account;
      medicalApi = setup.apis.medicalApi;
      fhirApi = setup.apis.fhirApi;
      // apiOSS = setup.apis.apiOSS;
    });
    afterAll(async () => {
      // await cleanUpE2ETest({ apiOSS, medicalApi, fhirApi }, account, isCreatingAccount);
    });

    it("gets an organization", async () => {
      const org = await medicalApi.getOrganization();

      if (!org) {
        throw new Error("Org not found");
      }

      const fhirOrg = await fhirApi.readResource(ResourceType.Organization, org.id, fhirHeaders);

      const cwOrg = await retryFunction<CWOrganization | undefined>(
        async () => await cwCommands.organization.getOne(org.oid),
        maxRetries
      );

      validateLocalOrg(org);
      validateFhirOrg(fhirOrg, org);
      validateCWOrg(cwOrg, org);
    });

    it("updates an organization", async () => {
      const org = await medicalApi.getOrganization();

      if (!org) {
        throw new Error("Org not found");
      }

      const newName = faker.word.noun();

      const updateOrg: Organization = {
        ...org,
        name: newName,
      };

      const updatedOrg = await medicalApi.updateOrganization(updateOrg);

      await fhirApi.invalidateAll();
      const fhirOrg: FhirOrg = await fhirApi.readResource(
        ResourceType.Organization,
        updatedOrg.id,
        fhirHeaders
      );

      const cwOrg: CWOrganization | undefined = await retryFunction<CWOrganization | undefined>(
        async () => await cwCommands.organization.getOne(updatedOrg.oid),
        maxRetries,
        result => result?.name === newName
      );

      validateLocalOrg(updatedOrg, updateOrg);
      validateFhirOrg(fhirOrg, updateOrg);
      validateCWOrg(cwOrg, updateOrg);
    });

    it("create a facility", async () => {
      facility = await medicalApi.createFacility(createFacility);

      validateFacility(facility);
    });

    it("updates a facility", async () => {
      const newName = faker.word.noun();

      const updateFacility: Facility = {
        ...facility,
        name: newName,
      };

      facility = await medicalApi.updateFacility(updateFacility);

      validateFacility(facility);
      expect(facility.name).toBe(newName);
    });

    // TODO: #1022 - TO BE USED WHEN ABLE TO HIT INTERNAL IN GITHUB RUNNER
    // it("gets all facilities for account", async () => {
    //   const facilities = await medicalApi.listFacilities();

    //   expect(facilities.length).toBe(1);
    // });

    it("gets one facility", async () => {
      const getFacility = await medicalApi.getFacility(facility.id);

      validateFacility(getFacility);
    });

    it("creates a patient", async () => {
      const org = await medicalApi.getOrganization();

      if (!org) {
        throw new Error("Org not found");
      }

      patient = await medicalApi.createPatient(createPatient, facility.id);

      const fhirPatient = await fhirApi.readResource(ResourceType.Patient, patient.id, fhirHeaders);

      validateLocalPatient(patient);
      validateFhirPatient(fhirPatient);

      // Creating a CW patient is done in the background need to await so we can query docs
      await Util.sleep(10000);

      // TODO: #1022 - TO BE USED WHEN ABLE TO HIT INTERNAL IN GITHUB RUNNER
      // const localPatientResp = await apiOSS.get(
      //   `${PATIENT}/${patient.id}?cxId=${account.customer.id}`
      // );
      // const cwPatientId = localPatientResp.data.data.externalData["COMMONWELL"].patientId;

      // const cwPatient = await retryFunction<CWPatient | undefined>(
      //   async () => await cwCommands.patient.getOne(org, facility, cwPatientId),
      //   maxRetries
      // );

      // validateCWPatient(cwPatient);
    });

    it("creates consolidated data for patient", async () => {
      const payload = createConsolidated(patient.id);
      const consolidated = await medicalApi.createPatientConsolidated(patient.id, payload);
      const count = await medicalApi.countPatientConsolidated(patient.id);

      expect(count.total).toBe(1);
      expect(consolidated).toBeTruthy();
    });

    it("triggers a document query for the created patient", async () => {
      const docQueryProgress = await medicalApi.startDocumentQuery(patient.id, facility.id);
      let status = await medicalApi.getDocumentQueryStatus(patient.id);

      while (
        status.download?.status === "processing" ||
        (status.convert && status.convert?.status === "processing")
      ) {
        await Util.sleep(5000);
        status = await medicalApi.getDocumentQueryStatus(patient.id);
      }

      const documents = await medicalApi.listDocuments(patient.id, facility.id);

      expect(docQueryProgress).toBeTruthy();
      expect(documents).toBeTruthy();
      expect(documents.length).toBe(2);
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

      expect(count.total).toBe(0);
    });

    // TODO: #1022 - TO BE USED WHEN ABLE TO HIT INTERNAL IN GITHUB RUNNER
    // it("updates a patient", async () => {
    // const org = await medicalApi.getOrganization();

    // if (!org) {
    //   throw new Error("Org not found");
    // }

    // // Secondary patient with docs
    // const newName = "Dave";
    // const dob = "1980-01-01";

    // // Getting etag issue if not fetched again
    // const newPatient = await medicalApi.getPatient(patient.id);

    // const updatePatient: Patient = {
    //   ...newPatient,
    //   firstName: newName,
    //   dob,
    // };

    // patient = await medicalApi.updatePatient(updatePatient, facility.id);

    // await fhirApi.invalidateAll();
    // const fhirPatient: FhirPatient = await fhirApi.readResource(
    //   ResourceType.Patient,
    //   patient.id,
    //   fhirHeaders
    // );

    // validateLocalPatient(patient);
    // validateFhirPatient(fhirPatient);
    // expect(patient.firstName).toBe(newName);
    // expect(fhirPatient.name?.[0].given?.[0]).toBe(newName);

    // await Util.sleep(10000);

    // const localPatientResp = await apiOSS.get(
    //   `${PATIENT}/${patient.id}?cxId=${account.customer.id}`
    // );
    // const cwPatientId = localPatientResp.data.data.externalData["COMMONWELL"].patientId;

    // const cwPatient = await retryFunction<CWPatient | undefined>(
    //   async () => await cwCommands.patient.getOne(org, facility, cwPatientId),
    //   maxRetries
    // );

    // validateCWPatient(cwPatient);
    // expect(cwPatient?.details.name?.[0].given?.[0]).toBe(newName);
    // });

    // it("deletes a patient", async () => {
    //   await apiOSS.delete(
    //     `${PATIENT}/${patient.id}?cxId=${account.customer.id}&facilityId=${facility.id}`
    //   );

    //   const patients = await medicalApi.listPatients(facility.id);

    //   expect(patients.length).toBe(0);
    // });

    // it("deletes a facility", async () => {
    //   await apiOSS.delete(`${FACILITY}/${facility.id}?cxId=${account.customer.id}`);

    //   const facilities = await medicalApi.listFacilities();

    //   expect(facilities.length).toBe(0);
    // });

    // it("deletes an organization", async () => {
    //   const org = await medicalApi.getOrganization();

    //   if (!org) {
    //     throw new Error("Org not found");
    //   }

    //   await apiOSS.delete(`${ORGANIZATION}?cxId=${account.customer.id}`);
    //   await apiOSS.put(`${ORGANIZATION}/increment/${INCREMENT_ORG_ID}?cxId=${account.customer.id}`);

    //   await fhirApi.invalidateAll();
    //   const fhirOrg = await fhirApi.searchResources(
    //     ResourceType.Organization,
    //     `_id=${org.id}`,
    //     fhirHeaders
    //   );
    //   const deleteOrg = await medicalApi.getOrganization();

    //   expect(fhirOrg.length).toBe(0);
    //   expect(deleteOrg).toBeFalsy();
    // });
  });
}
