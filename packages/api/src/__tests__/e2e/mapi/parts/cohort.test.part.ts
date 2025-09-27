import { faker } from "@faker-js/faker";
import { COHORT_COLORS, CohortUpdate } from "@metriport/shared/domain/cohort";
import { E2eContext, medicalApi } from "../shared";
import { createCohort, validateCohort } from "./cohort";

/**
 * TODO(ENG-1116): Right now there should be 0 default cohorts.
 * After ENG-1116 is done, we will have 3 default cohorts.
 */
const DEFAULT_COHORT_COUNT = 0;

export function runCohortTestsPart1(e2e: E2eContext) {
  it("lists all available cohorts", async () => {
    const cohorts = await medicalApi.listCohorts();
    expect(cohorts).toBeTruthy();
    expect(cohorts.length).toEqual(DEFAULT_COHORT_COUNT);
    cohorts.forEach(cohort => {
      validateCohort(cohort);
    });
  });

  it("creates a cohort", async () => {
    e2e.cohort = await medicalApi.createCohort(createCohort);
    validateCohort(e2e.cohort);
  });

  it("gets a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const foundCohort = await medicalApi.getCohort(e2e.cohort.id);
    validateCohort(foundCohort);
  });

  it("gets a cohort by name", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const foundCohort = await medicalApi.getCohortByName(e2e.cohort.name);
    validateCohort(foundCohort);
  });

  it("updates a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const updateCohort: CohortUpdate = {
      ...e2e.cohort,
      name: faker.word.noun(),
      color: faker.helpers.arrayElement(COHORT_COLORS),
      description: faker.lorem.sentence(),
    };
    await medicalApi.updateCohort(e2e.cohort.id, updateCohort);

    e2e.cohort = await medicalApi.getCohort(e2e.cohort.id);
    expect(e2e.cohort.color).toEqual(updateCohort.color);
    expect(e2e.cohort.description).toEqual(updateCohort.description);
    expect(e2e.cohort.name).toEqual(updateCohort.name);
  });

  it("adds + removes a patient from a cohort (individually)", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    if (!e2e.patient) throw new Error("Missing patient");

    await medicalApi.addPatientToCohort(e2e.cohort.id, e2e.patient.id);
    await medicalApi.removePatientFromCohort(e2e.cohort.id, e2e.patient.id);
  });

  it("adds + removes patient(s) from a cohort (bulk)", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    if (!e2e.patient) throw new Error("Missing patient");

    await medicalApi.bulkAddPatientsToCohort(e2e.cohort.id, [e2e.patient.id]);
    await medicalApi.bulkRemovePatientsFromCohort(e2e.cohort.id, [e2e.patient.id]);
  });

  it("lists cohorts for a patient", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    if (!e2e.patient) throw new Error("Missing patient");

    await medicalApi.addPatientToCohort(e2e.cohort.id, e2e.patient.id);
    const cohorts = await medicalApi.listCohortsForPatient(e2e.patient.id);
    expect(cohorts.length).toEqual(1);
    expect(cohorts[0].id).toEqual(e2e.cohort.id);
    await medicalApi.removePatientFromCohort(e2e.cohort.id, e2e.patient.id);
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
