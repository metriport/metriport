/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { CohortUpdate } from "@metriport/api-sdk";
import { E2eContext, medicalApi } from "../shared";
import { createCohort, validateCohort } from "./cohort";

export function runCohortTestsPart1(e2e: E2eContext) {
  it("creates a cohort", async () => {
    e2e.cohort = await medicalApi.createCohort(createCohort);
    validateCohort(e2e.cohort);
  });

  it("gets a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const foundCohort = await medicalApi.getCohort(e2e.cohort.id);
    validateCohort(foundCohort.cohort);
    expect(foundCohort.patientCount).toEqual(0);
    expect(foundCohort.patientIds).toEqual([]);
  });

  it("updates a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const newName = faker.word.noun();
    const updateCohort: CohortUpdate = {
      ...e2e.cohort,
      name: newName,
    };
    const updatedCohort = await medicalApi.updateCohort(updateCohort);
    e2e.cohort = (await medicalApi.getCohort(e2e.cohort.id)).cohort;
    expect(e2e.cohort.name).toEqual(newName);
    expect(updatedCohort.name).toEqual(newName);
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
