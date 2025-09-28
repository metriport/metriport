import { faker } from "@faker-js/faker";
import { COHORT_COLORS, CohortUpdateRequest } from "@metriport/shared/domain/cohort";
import { E2eContext, medicalApi } from "../shared";
import { createCohort, validateCohort } from "./cohort";

export function runCohortTestsPart1(e2e: E2eContext) {
  it("creates a cohort", async () => {
    e2e.cohort = await medicalApi.createCohort(createCohort);
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
    const { cohort, details } = await medicalApi.getCohortWithDetails(e2e.cohort.id);
    validateCohort(cohort);
    expect(details.patientIds).toBeTruthy();
    expect(details.size).toBe(0);
  });

  it("gets a cohort by name", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const foundCohort = await medicalApi.getCohortByName(e2e.cohort.name);
    expect(foundCohort.id).toEqual(e2e.cohort.id);
    validateCohort(foundCohort);
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

    const { cohort } = await medicalApi.getCohortWithDetails(e2e.cohort.id);

    e2e.cohort = cohort;
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
    expect(async () => medicalApi.getCohortWithDetails(cohort.id)).rejects.toThrow(
      "Request failed with status code 404"
    );
  });
}
