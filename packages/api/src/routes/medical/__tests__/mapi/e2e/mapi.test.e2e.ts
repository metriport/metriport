import * as dotenv from "dotenv";
dotenv.config();

import { Organization, Facility, Patient } from "@metriport/api-sdk";
import { Organization as CWOrganization } from "@metriport/commonwell-sdk";
import { Organization as FhirOrg } from "@medplum/fhirtypes";
import { faker } from "@faker-js/faker";
import * as cwCommands from "../../../../../external/commonwell/__tests__";
import { validateCWOrg, validateFhirOrg, validateLocalOrg } from "./organization";
import { createFacility, validateFacility } from "./facility";
import { createPatient, validateFhirPatient, validateLocalPatient } from "./patient";
import { createConsolidated } from "./consolidated";
import { fhirHeaders, ResourceType, fhirApi, medicalApi } from "./shared";
import { retryFunction } from "../../../../../shared/retry";
import { Util } from "../../../../../shared/util";
import { Config } from "../../../../../shared/config";

const maxRetries = 4;

jest.setTimeout(30000);

// NEVER TO BE RUN IN PRODUCTION
if (Config.isStaging() || !Config.isCloudEnv()) {
  describe("MAPI E2E Tests", () => {
    let facility: Facility;
    let patient: Patient;

    it("gets an organization", async () => {
      const org = await medicalApi.getOrganization();

      expect(org).toBeTruthy();

      if (org) {
        const fhirOrg = await fhirApi.readResource(ResourceType.Organization, org.id, fhirHeaders);

        const cwOrg = await retryFunction<CWOrganization | undefined>(
          async () => await cwCommands.organization.getOne(org.oid),
          maxRetries,
          3000
        );

        validateLocalOrg(org);
        validateFhirOrg(fhirOrg, org);
        validateCWOrg(cwOrg, org);
      }
    });

    it("updates an organization", async () => {
      const org = await medicalApi.getOrganization();

      expect(org).toBeTruthy();

      if (org) {
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
          3000,
          result => result?.name === newName
        );

        validateLocalOrg(updatedOrg, updateOrg);
        validateFhirOrg(fhirOrg, updateOrg);
        validateCWOrg(cwOrg, updateOrg);
      }
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

      validateFacility(facility, updateFacility);
      expect(facility.name).toBe(newName);
    });

    it("gets one facility", async () => {
      const getFacility = await medicalApi.getFacility(facility.id);

      validateFacility(getFacility);
    });

    it("creates a patient", async () => {
      patient = await medicalApi.createPatient(createPatient, facility.id);

      const fhirPatient = await fhirApi.readResource(ResourceType.Patient, patient.id, fhirHeaders);

      validateLocalPatient(patient);
      validateFhirPatient(fhirPatient);

      // Creating a CW patient is done in the background need to await so we can query docs
      await Util.sleep(10000);
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
  });
} else {
  describe("Prod Tests", () => {
    test.todo("This is a todo for prod tests so this file doesnt break");
  });
}
