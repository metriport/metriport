import { faker } from "@faker-js/faker";
import { COHORT_COLORS, CohortUpdateRequestWithoutSettings } from "@metriport/shared/domain/cohort";
import { COHORT_SEED_ID, E2eContext, medicalApi } from "../shared";
import { validateCohort } from "./cohort";
import { createSecondaryPatient } from "./patient";

export function runCohortTestsPart1(e2e: E2eContext) {
  it("gets a cohort", async () => {
    const cohort = await medicalApi.getCohort(COHORT_SEED_ID);
    e2e.cohort = cohort;
    validateCohort(cohort);
  });

  it("lists all available cohorts", async () => {
    const { cohorts } = await medicalApi.listCohorts();
    expect(cohorts).toBeTruthy();
    expect(cohorts.length).toBeGreaterThan(0);
    cohorts.forEach(cohort => {
      validateCohort(cohort);
    });
  });

  it("updates a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const color = faker.helpers.arrayElement(COHORT_COLORS);
    const updateCohort: CohortUpdateRequestWithoutSettings & { id: string } = {
      id: e2e.cohort.id,
      name: faker.word.noun(),
      color,
      description: faker.lorem.sentence(),
      eTag: e2e.cohort.eTag,
    };
    const cohort = await medicalApi.updateCohort(updateCohort);

    e2e.cohort = cohort;
    expect(e2e.cohort.color).toEqual(color);
    expect(e2e.cohort.description).toEqual(updateCohort.description);
    expect(e2e.cohort.name).toEqual(updateCohort.name);
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
      id: e2e.cohort.id,
      pagination: { count: 1 },
    });
    expect(page1Patients.length).toEqual(1);
    expect(page1Meta.itemsOnPage).toEqual(1);
    expect(page1Meta.itemsInTotal).toEqual(2);
    if (!page1Meta.nextPage) throw new Error("Missing next page");

    const { meta: page2Meta, patients: page2Patients } = await medicalApi.getCohortPatientsPage(
      page1Meta.nextPage
    );

    expect(page2Patients.length).toEqual(1);
    expect(page2Meta.itemsOnPage).toEqual(1);
    expect(page2Meta.nextPage).not.toBeDefined();
    const allPatientIds = [...page1Patients, ...page2Patients].map(p => p.id);
    expect(allPatientIds).toContain(e2e.patient.id);
    expect(allPatientIds).toContain(secondaryPatient.id);
    expect(allPatientIds.length).toEqual(2);

    await medicalApi.removePatientsFromCohort({
      patientIds: [e2e.patient.id, secondaryPatient.id],
      cohortId: e2e.cohort.id,
    });
    await medicalApi.deletePatient(secondaryPatient.id, e2e.facility.id);
  });
}
