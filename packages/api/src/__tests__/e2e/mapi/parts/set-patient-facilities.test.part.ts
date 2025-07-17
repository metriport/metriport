import { E2eContext } from "../shared";
import { medicalApi } from "../shared";
import { faker } from "@faker-js/faker";
import { FacilityCreate } from "@metriport/api-sdk";
import { USState } from "@metriport/shared";
import { makeNPI } from "@metriport/shared/common/__tests__/npi";

/**
 * E2E tests for setting patient facilities functionality
 *
 * Tests the ability to set and manage patient facility associations.
 */
export function runSetPatientFacilitiesTests(e2e: E2eContext) {
  describe("Set Patient Facilities", () => {
    it("should manage patient facilities lifecycle", async () => {
      // Use the patient created in the Patient e2e test
      if (!e2e.patient) throw new Error("Missing patient from Patient e2e test");
      const testPatient = e2e.patient;
      console.log(
        `Testing with patient: ${testPatient.firstName} ${testPatient.lastName} (${testPatient.id})`
      );

      // Get the patient's current facilities
      const currentPatientFacilities = await medicalApi.getPatientFacilities(testPatient.id);
      expect(currentPatientFacilities.length).toBeGreaterThan(0);

      // Store the original facility (first facility the patient is associated with)
      const originalFacility = currentPatientFacilities[0];
      console.log(`Original facility: ${originalFacility.name} (${originalFacility.id})`);

      // Create another facility with a unique NPI to avoid conflicts
      const uniqueFacilityData: FacilityCreate = {
        name: faker.word.noun(),
        npi: makeNPI(), // This will generate a different NPI than the one used in facility tests
        active: true,
        address: {
          addressLine1: faker.location.streetAddress(),
          city: faker.location.city(),
          state: USState.CA,
          zip: faker.location.zipCode("#####"),
          country: "USA",
        },
      };
      const newFacility = await medicalApi.createFacility(uniqueFacilityData);
      console.log(`Created new facility: ${newFacility.name} (${newFacility.id})`);

      try {
        // Set the patient's facilities to be both the original facility and new facility
        const bothFacilityIds = [originalFacility.id, newFacility.id];
        const updatedFacilities = await medicalApi.setPatientFacilities(
          testPatient.id,
          bothFacilityIds
        );

        expect(updatedFacilities.length).toBe(2);
        expect(updatedFacilities.map(f => f.id)).toEqual(expect.arrayContaining(bothFacilityIds));
        console.log(`Successfully set patient to both facilities: ${bothFacilityIds.join(", ")}`);

        // Verify using the get endpoint that the patient has 2 facilities
        const verifyFacilities = await medicalApi.getPatientFacilities(testPatient.id);
        expect(verifyFacilities.length).toBe(2);
        expect(verifyFacilities.map(f => f.id)).toEqual(expect.arrayContaining(bothFacilityIds));
        console.log(`Verified patient has 2 facilities via get endpoint`);

        // Set the patient to have just the original facility
        const singleFacilityUpdate = await medicalApi.setPatientFacilities(testPatient.id, [
          originalFacility.id,
        ]);

        expect(singleFacilityUpdate.length).toBe(1);
        expect(singleFacilityUpdate[0].id).toBe(originalFacility.id);
        console.log(`Successfully set patient back to original facility only`);

        // Verify the patient now has only the original facility
        const finalVerifyFacilities = await medicalApi.getPatientFacilities(testPatient.id);
        expect(finalVerifyFacilities.length).toBe(1);
        expect(finalVerifyFacilities[0].id).toBe(originalFacility.id);
        console.log(`Verified patient has only original facility`);
      } finally {
        // Delete the second facility
        await medicalApi.deleteFacility(newFacility.id);
        console.log(`Successfully deleted the second facility: ${newFacility.id}`);
      }
    });
  });
}
