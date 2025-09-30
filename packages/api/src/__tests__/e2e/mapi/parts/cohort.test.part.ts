import { faker } from "@faker-js/faker";
import { COHORT_COLORS, CohortUpdateRequest } from "@metriport/shared/domain/cohort";
import { E2eContext, medicalApi } from "../shared";
import { createCohort, validateCohort } from "./cohort";
import { createSecondaryPatient } from "./patient";

export function runCohortTestsPart1(e2e: E2eContext) {
  it("creates a cohort", async () => {
    const { cohort } = await medicalApi.createCohort(createCohort);
    e2e.cohort = cohort;
    validateCohort(e2e.cohort);
  });

  it("lists all available cohorts", async () => {
    const { cohorts } = await medicalApi.listCohorts();
    expect(cohorts).toBeTruthy();
    expect(cohorts.length).toBeGreaterThan(0);
    cohorts.forEach(cohort => {
      validateCohort(cohort);
    });
  });

  it("gets a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const { cohort, size } = await medicalApi.getCohort(e2e.cohort.id);
    validateCohort(cohort);
    expect(size).toBe(0);
  });

  it("gets a cohort by name", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const { cohort } = await medicalApi.getCohortByName(e2e.cohort.name);
    expect(cohort.id).toEqual(e2e.cohort.id);
    validateCohort(cohort);
  });

  it("updates a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const updateCohort: CohortUpdateRequest = {
      ...e2e.cohort,
      name: faker.word.noun(),
      color: faker.helpers.arrayElement(COHORT_COLORS),
      description: faker.lorem.sentence(),
    };
    await medicalApi.updateCohort(e2e.cohort.id, updateCohort);

    const { cohort } = await medicalApi.getCohort(e2e.cohort.id);

    e2e.cohort = cohort;
    expect(e2e.cohort.description).toEqual(updateCohort.description);
    expect(e2e.cohort.name).toEqual(updateCohort.name);
  });

  it("adds + removes patient(s) from a cohort (bulk)", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    if (!e2e.patient) throw new Error("Missing patient");

    await medicalApi.addPatientsToCohort({
      cohortId: e2e.cohort.id,
      patientIds: [e2e.patient.id],
    });
    await medicalApi.removePatientsFromCohort({
      cohortId: e2e.cohort.id,
      patientIds: [e2e.patient.id],
    });
  });

  it("lists cohorts for a patient", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    if (!e2e.patient) throw new Error("Missing patient");

    await medicalApi.addPatientsToCohort({ patientIds: [e2e.patient.id], cohortId: e2e.cohort.id });
    const { cohorts } = await medicalApi.listCohortsForPatient(e2e.patient.id);
    expect(cohorts.length).toEqual(1);
    expect(cohorts[0].id).toEqual(e2e.cohort.id);
    await medicalApi.removePatientsFromCohort({
      patientIds: [e2e.patient.id],
      cohortId: e2e.cohort.id,
    });
  });

  it("lists patients in a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    if (!e2e.patient) throw new Error("Missing patient");
    if (!e2e.facility) throw new Error("Missing facility");

    const secondaryPatient = await medicalApi.createPatient(
      createSecondaryPatient,
      e2e.facility.id
    );
    await medicalApi.addPatientsToCohort({
      patientIds: [e2e.patient.id, secondaryPatient.id],
      cohortId: e2e.cohort.id,
    });
    const { meta: page1Meta, patients: page1Patients } = await medicalApi.listPatientsInCohort({
      cohortId: e2e.cohort.id,
      pagination: { count: 1 },
    });
    expect(page1Patients.length).toEqual(1);
    expect(page1Patients[0].id).toEqual(secondaryPatient.id);
    expect(page1Meta.itemsOnPage).toEqual(1);
    expect(page1Meta.itemsInTotal).toEqual(2);
    if (!page1Meta.nextPage) throw new Error("Missing next page");
    console.log(`page1Meta.nextPage: ${page1Meta.nextPage}`);

    const { meta: page2Meta, patients: page2Patients } = await medicalApi.listPatientsInCohortPage(
      page1Meta.nextPage
    );

    expect(page2Patients.length).toEqual(1);
    expect(page2Patients[0].id).toEqual(e2e.patient.id);
    expect(page2Meta.itemsOnPage).toEqual(1);
    expect(page2Meta.nextPage).not.toBeDefined();

    await medicalApi.removePatientsFromCohort({
      patientIds: [e2e.patient.id, secondaryPatient.id],
      cohortId: e2e.cohort.id,
    });
    await medicalApi.deletePatient(secondaryPatient.id, e2e.facility.id);
  });

  it("gets settings for a patient", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    if (!e2e.patient) throw new Error("Missing patient");

    await medicalApi.addPatientsToCohort({ patientIds: [e2e.patient.id], cohortId: e2e.cohort.id });
    const { settings } = await medicalApi.getPatientSettings(e2e.patient.id);
    expect(settings).toBeTruthy();
    expect(settings.adtMonitoring).toEqual(e2e.cohort.settings.adtMonitoring);
    await medicalApi.removePatientsFromCohort({
      patientIds: [e2e.patient.id],
      cohortId: e2e.cohort.id,
    });
  });
}

export function runCohortTestsPart2(e2e: E2eContext) {
  it("deletes the cohort", async () => {
    const cohort = e2e.cohort;
    if (!cohort) throw new Error("Missing cohort");
    await medicalApi.deleteCohort(cohort.id);
    expect(async () => medicalApi.getCohort(cohort.id)).rejects.toThrow(
      "Request failed with status code 404"
    );
  });
}
