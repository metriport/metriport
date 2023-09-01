import * as dotenv from "dotenv";
dotenv.config();

import { MetriportMedicalApi, Organization, Facility, Patient } from "@metriport/api-sdk";
import { faker } from "@faker-js/faker";
import { AxiosInstance } from "axios";
import { FhirClient } from "../../../../../external/fhir/api/api";
import { ResourceType } from "../../../../../external/fhir/shared";
import cwCommands from "../../../../../external/commonwell";
import { validateCWOrg, validateFhirOrg, validateLocalOrg, createOrg } from "./organization";
import { createFacility, validateFacility } from "./facility";
import { createPatient, validateFhirPatient, validateLocalPatient } from "./patient";
import { createConsolidated } from "./consolidated";
import { setupE2ETest, retryFunction, cleanUpE2ETest } from "./shared";
import { Util } from "../../../../../shared/util";

type Customer = {
  id: string;
  subscriptionStatus: "disabled" | "active" | "overdue";
  stripeCxId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  website: string | null;
};

const INCREMENT_ORG_ID = "018a4712-52c2-716c-a4a3-11e5a54d7e49";
const ORGANIZATION = "/medical/v1/organization";
const FACILITY = "/medical/v1/facility";
const maxRetries = 4;

jest.setTimeout(30000);

// NEED TO WORK THIS FOR JUST DEV AN STAGING - DISABLE IN PROD

describe("MAPI E2E Tests", () => {
  let account: { customer: Customer; idToken: string; accessToken: string };
  let medicalApi: MetriportMedicalApi;
  let fhirApi: FhirClient;
  let ossApi: AxiosInstance;

  let org: Organization;
  let facility: Facility;
  let patient: Patient;

  // only for now
  const isDummy = true;

  beforeAll(async () => {
    const setup = await setupE2ETest(isDummy);

    account = setup.account;
    medicalApi = setup.apis.medicalApi;
    fhirApi = setup.apis.fhirApi;
    ossApi = setup.apis.ossApi;
  });
  afterAll(async () => {
    await cleanUpE2ETest({ ossApi, medicalApi, fhirApi }, account, isDummy);
  });

  it("creates an organization", async () => {
    org = await medicalApi.createOrganization(createOrg);

    const fhirOrg = await fhirApi.readResource(ResourceType.Organization, org.id);

    const cwOrg = await retryFunction(
      async () => await cwCommands.organization.getOne(org.oid),
      maxRetries
    );

    validateLocalOrg(org, createOrg);
    validateFhirOrg(fhirOrg, createOrg);
    validateCWOrg(cwOrg, createOrg);
  });

  it("updates an organization", async () => {
    const newName = faker.word.noun();

    const updateOrg: Organization = {
      ...org,
      name: newName,
    };

    org = await medicalApi.updateOrganization(updateOrg);

    await fhirApi.invalidateAll();
    const fhirOrg = await fhirApi.readResource(ResourceType.Organization, org.id);

    const cwOrg = await retryFunction(
      async () => await cwCommands.organization.getOne(org.oid),
      maxRetries,
      { key: "name", value: newName }
    );

    validateLocalOrg(org, updateOrg);
    validateFhirOrg(fhirOrg, updateOrg);
    validateCWOrg(cwOrg, updateOrg);
  });

  it("create a facility", async () => {
    facility = await medicalApi.createFacility(createFacility);

    validateFacility(facility, createFacility);
  });

  it("updates a facility", async () => {
    const newName = faker.word.noun();

    const updateFacility: Facility = {
      ...facility,
      name: newName,
    };

    facility = await medicalApi.updateFacility(updateFacility);

    validateFacility(facility, updateFacility);
  });

  it("gets all facilities for account", async () => {
    const facilities = await medicalApi.listFacilities();

    expect(facilities.length).toBe(1);
  });

  it("gets one facility", async () => {
    const getFacility = await medicalApi.getFacility(facility.id);

    validateFacility(getFacility, facility);
  });

  it("creates a patient", async () => {
    patient = await medicalApi.createPatient(createPatient, facility.id);

    const fhirPatient = await fhirApi.readResource(ResourceType.Patient, patient.id);

    validateLocalPatient(patient, createPatient);
    validateFhirPatient(fhirPatient);

    await Util.sleep(10000);
  });

  // CONSIDER TESTING WEBHOOK FOR THIS
  it("creates consolidated data for patient", async () => {
    const payload = createConsolidated(patient.id);
    const consolidated = await medicalApi.createPatientConsolidated(patient.id, payload);
    const count = await medicalApi.countPatientConsolidated(patient.id);

    expect(count.total).toBe(1);
    expect(consolidated).toBeTruthy();
  });

  // In order to test doc query i need to have another org already set up with a patient in it similiar demographics to the one i just created

  it("triggers a document query for the specified patient across HIEs", async () => {
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
    expect(documents.length).toBe(1);
  });

  it("deletes a patient's consolidated data", async () => {
    const consolidated = await medicalApi.getPatientConsolidated(patient.id);
    const allergyResource = consolidated.entry?.[0]?.resource;
    const docRefResource = consolidated.entry?.[1]?.resource;

    if (allergyResource && allergyResource.id && docRefResource && docRefResource.id) {
      await fhirApi.deleteResource(allergyResource.resourceType, allergyResource.id);
      await fhirApi.deleteResource(docRefResource.resourceType, docRefResource.id);
    }

    const count = await medicalApi.countPatientConsolidated(patient.id);

    expect(count.total).toBe(0);
  });

  it("deletes a patient", async () => {
    await medicalApi.deletePatient(patient.id, facility.id);

    const patients = await medicalApi.listPatients(facility.id);

    expect(patients.length).toBe(0);
  });

  it("deletes a facility", async () => {
    await ossApi.delete(`${FACILITY}/${facility.id}`);

    const facilities = await medicalApi.listFacilities();

    expect(facilities.length).toBe(0);
  });

  it("deletes an organization", async () => {
    await ossApi.delete(ORGANIZATION);
    await ossApi.put(`${ORGANIZATION}/increment/${INCREMENT_ORG_ID}`);

    await fhirApi.invalidateAll();
    const fhirOrg = await fhirApi.searchResources(ResourceType.Organization, `_id=${org.id}`);
    const deleteOrg = await medicalApi.getOrganization();

    expect(fhirOrg.length).toBe(0);
    expect(deleteOrg).toBeFalsy();
  });
});
