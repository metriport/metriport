/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { Facility } from "@metriport/api-sdk";
import { createFacility, validateFacility } from "./facility";
import { E2eContext, medicalApi } from "../shared";

export function runFacilityTestsPart1(e2e: E2eContext) {
  it("creates a facility", async () => {
    e2e.facility = await medicalApi.createFacility(createFacility);
    validateFacility(e2e.facility);
  });

  it("gets a facility", async () => {
    if (!e2e.facility) throw new Error("Missing facility");
    const foundFacility = await medicalApi.getFacility(e2e.facility.id);
    validateFacility(foundFacility);
  });

  it("updates a facility", async () => {
    if (!e2e.facility) throw new Error("Missing facility");
    const newName = faker.word.noun();
    const updateFacility: Facility = {
      ...e2e.facility,
      name: newName,
    };
    const updatedFacility = await medicalApi.updateFacility(updateFacility);
    e2e.facility = await medicalApi.getFacility(e2e.facility.id);
    expect(e2e.facility.name).toEqual(newName);
    expect(updatedFacility.name).toEqual(newName);
  });
}

export function runFacilityTestsPart2(e2e: E2eContext) {
  it("deletes the facility", async () => {
    const facility = e2e.facility;
    if (!facility) throw new Error("Missing facility");
    await medicalApi.deleteFacility(facility.id);
    expect(async () => medicalApi.getFacility(facility.id)).rejects.toThrow(
      "Request failed with status code 404"
    );
  });
}
