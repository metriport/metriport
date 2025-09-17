import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import HealthieApi, { isHealthieEnv } from "@metriport/core/external/ehr/healthie/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { MetriportError } from "@metriport/shared";
import fs from "fs";

const apiKey = getEnvVarOrFail("EHR_HEALTHIE_API_KEY");
const environment = getEnvVarOrFail("EHR_HEALTHIE_ENVIRONMENT");
const cxId = getEnvVarOrFail("CX_ID");
const practiceId = getEnvVarOrFail("EHR_HEALTHIE_PRACTICE_ID");

const patientIds: string[] = [];

const batchSize = 5;
const delayMs = 2000;

interface RemoveLinkResult {
  patientId: string;
  success: boolean;
  error?: string;
}

const removeLinksJobId = "RL_" + buildDayjs().toISOString().slice(0, 19).replace(/[:.]/g, "-");

/**
 * Removes Metriport integration links frxom Healthie patient quick notes.
 * This function scrubs the Metriport Integration link from the patient's quick notes.
 */
export async function removeLinks(): Promise<RemoveLinkResult[]> {
  const { log } = out(`bulkRemoveLinks - ${patientIds.length} patients`);

  if (patientIds.length === 0) {
    log("No patient IDs provided");
    return [];
  }

  if (!isHealthieEnv(environment)) {
    throw new MetriportError("Invalid Healthie environment", undefined, { environment });
  }

  // Create Healthie client
  const healthieClient = await HealthieApi.create({
    apiKey,
    environment,
    practiceId,
  });

  const results: RemoveLinkResult[] = [];

  log(`Processing ${patientIds.length} patients with executeAsynchronously`);

  await executeAsynchronously(
    patientIds.slice(1),
    async patientId => {
      try {
        await healthieClient.updatePatientQuickNotesWithLink({
          cxId,
          patientId,
          link: "",
          removeLink: true,
        });
        results.push({ patientId, success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Failed to remove link for patient ${patientId}: ${errorMessage}`);
        results.push({ patientId, success: false, error: errorMessage });
      }
    },
    {
      numberOfParallelExecutions: batchSize,
      minJitterMillis: delayMs,
      maxJitterMillis: delayMs * 2,
    }
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  log(`Completed bulk link removal: ${successCount} successful, ${failureCount} failed`);

  return results;
}

/**
 * Main function to run the bulk link removal script.
 * This can be called directly or used as a module.
 */
export async function main(): Promise<void> {
  try {
    const results = await removeLinks();

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log("Bulk link removal completed:");
    console.log(`Total processed: ${results.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);

    // Create output files for successful and failed patient IDs
    if (successCount > 0) {
      const successfulPatientIds = results.filter(r => r.success).map(r => r.patientId);
      const successOutputFile = `bulk-remove-links_successful-patient-ids_${removeLinksJobId}.txt`;
      fs.writeFileSync(successOutputFile, successfulPatientIds.join("\n"));
      console.log(`Successful patient IDs written to: ${successOutputFile}`);
    }

    if (failureCount > 0) {
      const failedPatientIds = results.filter(r => !r.success).map(r => r.patientId);
      const failureOutputFile = `bulk-remove-links_failed-patient-ids_${removeLinksJobId}.txt`;
      fs.writeFileSync(failureOutputFile, failedPatientIds.join("\n"));
      console.log(`Failed patient IDs written to: ${failureOutputFile}`);

      // Also create a detailed failure report with error messages
      const detailedFailureFile = `bulk-remove-links_failed-details_${removeLinksJobId}.txt`;
      const failedDetails = results
        .filter(r => !r.success)
        .map(r => `${r.patientId}: ${r.error}`)
        .join("\n");
      fs.writeFileSync(detailedFailureFile, failedDetails);
      console.log(`Detailed failure report written to: ${detailedFailureFile}`);
    }

    console.log(`Job ID: ${removeLinksJobId}`);
  } catch (error) {
    console.error("Bulk link removal failed:", error);
    process.exit(1);
  }
}

main();
