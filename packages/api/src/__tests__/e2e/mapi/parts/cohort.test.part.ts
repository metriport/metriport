import { faker } from "@faker-js/faker";
import { Cohort } from "@metriport/api-sdk";
import { createCohort, validateCohort } from "./cohort";
import { E2eContext, medicalApi } from "../shared";

export function runCohortTestsPart1(e2e: E2eContext) {
  it("creates a cohort", async () => {
    e2e.cohort = await medicalApi.createCohort(createCohort);
    validateCohort(e2e.cohort);
  });

  it("gets a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const foundCohort = await medicalApi.getCohort(e2e.cohort.id);
    validateCohort(foundCohort);
  });

  it("updates a cohort", async () => {
    if (!e2e.cohort) throw new Error("Missing cohort");
    const newName = faker.word.noun();
    const updateCohort: Cohort = {
      ...e2e.cohort,
      name: newName,
    };
    const updatedCohort = await medicalApi.updateCohort(updateCohort);
    e2e.cohort = await medicalApi.getCohort(e2e.cohort.id);
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
