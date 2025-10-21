import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

/**
 * Tests all endpoints for cohorts using the SDK. Only tests the happy path!
 *
 * Expected output:
 *  🎉 All tests passed!
 *
 * Steps to use:
 *  1. Set up the enviornment variables:
 *    - API_KEY
 *    - API_URL
 *    - PT_ID
 *  2. Run the script:
 *    ts-node src/test-cohort-methods
 *
 */

const API_KEY = getEnvVarOrFail("API_KEY");
const BASE_URL = getEnvVarOrFail("API_URL");
const TEST_PATIENT_ID = getEnvVarOrFail("PT_ID");

const metriport = new MetriportMedicalApi(API_KEY, { baseAddress: BASE_URL });

async function main() {
  console.log("Testing cohort methods...");

  let cohortId: string | null = null;

  try {
    console.log("1. Creating cohort...");
    const createResult = await metriport.createCohort({
      name: `Test Cohort ${Date.now()}`,
      description: "Test cohort",
      color: "blue",
    });
    cohortId = createResult.cohort.id;
    console.log("✅ Created cohort:", cohortId);

    console.log("2. Listing cohorts...");
    const listResult = await metriport.listCohorts();
    console.log("✅ Listed cohorts:", listResult.cohorts.length);

    console.log("3. Getting cohort...");
    const getResult = await metriport.getCohort(cohortId);
    console.log("✅ Got cohort:", getResult.cohort.name);

    console.log("4. Updating cohort...");
    const updateResult = await metriport.updateCohort(cohortId, {
      description: "Updated test cohort",
      settings: {
        monitoring: {
          adt: false,
        },
      },
    });
    console.log("✅ Updated cohort");

    if (updateResult.cohort.description !== "Updated test cohort") {
      throw new Error(
        `Expected description "Updated test cohort", got "${updateResult.cohort.description}"`
      );
    }
    if (updateResult.cohort.settings.monitoring.adt !== false) {
      throw new Error(
        `Expected ADT to be false, got ${updateResult.cohort.settings.monitoring.adt}`
      );
    }
    console.log("✅ Verified cohort update");

    console.log("5. Adding patients to cohort...");
    await metriport.addPatientsToCohort({
      cohortId,
      patientIds: [TEST_PATIENT_ID],
    });
    console.log("✅ Added patients to cohort");

    console.log("6. Listing patients in cohort...");
    const patientsResult = await metriport.listPatientsInCohort({ cohortId });
    console.log("✅ Listed patients in cohort:", patientsResult.patients.length);

    if (!patientsResult.patients.some(p => p.id === TEST_PATIENT_ID)) {
      throw new Error(`Patient ${TEST_PATIENT_ID} not found in cohort ${cohortId}`);
    }
    console.log("✅ Verified patient is in cohort");

    console.log("7. Getting patient cohorts...");
    const patientCohortsResult = await metriport.listCohortsForPatient(TEST_PATIENT_ID);
    console.log("✅ Got patient cohorts:", patientCohortsResult.cohorts.length);

    if (!patientCohortsResult.cohorts.some(c => c.id === cohortId)) {
      throw new Error(`Patient ${TEST_PATIENT_ID} does not have cohort ${cohortId}`);
    }
    console.log("✅ Verified patient has cohort");

    console.log("8. Testing addPatientToCohorts...");
    await metriport.addPatientToCohorts(TEST_PATIENT_ID, [cohortId]);
    console.log("✅ Added patient to cohorts");

    console.log("9. Verifying patient still has cohort after addPatientToCohorts...");
    const patientCohortsAfterAdd = await metriport.listCohortsForPatient(TEST_PATIENT_ID);
    console.log(
      "✅ Patient cohorts after addPatientToCohorts:",
      patientCohortsAfterAdd.cohorts.length
    );

    if (!patientCohortsAfterAdd.cohorts.some(c => c.id === cohortId)) {
      throw new Error(
        `Patient ${TEST_PATIENT_ID} lost cohort ${cohortId} after addPatientToCohorts`
      );
    }
    console.log("✅ Verified patient still has cohort after addPatientToCohorts");

    console.log("10. Getting patient settings...");
    const settingsResult = await metriport.getPatientSettings(TEST_PATIENT_ID);
    console.log("✅ Got patient settings");

    if (settingsResult.settings.monitoring.adt !== false) {
      throw new Error(
        `Expected patient ADT to be false (from cohort), got ${settingsResult.settings.monitoring.adt}`
      );
    }
    console.log("✅ Verified patient settings reflect cohort settings");

    console.log("11. Removing patients from cohort...");
    await metriport.removePatientsFromCohort({
      cohortId,
      patientIds: [TEST_PATIENT_ID],
    });
    console.log("✅ Removed patients from cohort");

    console.log("12. Verifying patient was removed from cohort...");
    const patientsAfterRemoval = await metriport.listPatientsInCohort({ cohortId });
    console.log("✅ Patients in cohort after removal:", patientsAfterRemoval.patients.length);

    if (patientsAfterRemoval.patients.some(p => p.id === TEST_PATIENT_ID)) {
      throw new Error(`Patient ${TEST_PATIENT_ID} still found in cohort ${cohortId} after removal`);
    }
    console.log("✅ Verified patient was removed from cohort");

    console.log("13. Deleting cohort...");
    await metriport.deleteCohort(cohortId);
    console.log("✅ Deleted cohort");

    console.log("\n🎉 All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);

    if (cohortId) {
      try {
        await metriport.deleteCohort(cohortId);
        console.log("🧹 Cleaned up cohort");
      } catch (cleanupError) {
        console.error("Failed to cleanup:", cleanupError);
      }
    }

    process.exit(1);
  }
}

main();
