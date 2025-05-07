import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/shared";
import { APIMode, CommonWell, organizationQueryMeta } from "@metriport/commonwell-sdk";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { MedicalDataSource } from "@metriport/core/external/index";
import { getDelayTime } from "../shared/duration";
import { executeWithNetworkRetries } from "@metriport/shared";

/**
 * This script performs a full patient migration in CommonWell:
 * 1. Resets the patient's CW external data
 * 2. Runs patient discovery
 * 3. Deletes the patient in CommonWell using the old OID
 *
 * To run:
 * 1. Set the env vars:
 *  - CX_ID
 *  - API_URL
 *  - CW_CERT (the CommonWell certificate)
 *  - CW_KEY (the CommonWell private key)
 *  - CW_ORG_NAME (the name of the organization)
 * 2. Set the patientIds
 * 3. Set the oldCwOid
 * 4. Set the cwOrgName
 * 5. Set the orgNpi
 * 6. Run the script with `ts-node src/commonwell/migrate-patients.ts`
 */

dayjs.extend(duration);

const NETWORK_RETRY_MAX_ATTEMPTS = 3;
const NETWORK_RETRY_INITIAL_DELAY_MS = 500;
const NETWORK_RETRY_ON_TIMEOUT = true;

const patientIds: string[] = [];
const rerunPdOnNewDemographics = false;
const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");

const cwCert = getEnvVarOrFail("CW_CERT");
const cwKey = getEnvVarOrFail("CW_KEY");
const apiMode = APIMode.integration;

const PATIENT_CHUNK_SIZE = 2;

const oldCwOid = ""; // Not including the urn:oid: prefix. Ex: 1.2.3.4.5.6.7.8.9
const cwOrgName = "";
const orgNpi = "";

const confirmationTime = dayjs.duration(10, "seconds");
const delayTime = dayjs.duration(10, "seconds");
const minimumDelayTime = dayjs.duration(1, "seconds");

type PdResponse = {
  data: {
    requestId: string;
  };
};

function buildCWPatientId(orgOID: string, patientId: string): string {
  return `${patientId}%5E%5E%5Eurn%3aoid%3a${orgOID}`;
}

async function main() {
  const { log } = out("migrate-patients");
  try {
    await displayInitialWarningAndConfirmation(patientIds.length);

    const patientChunks = chunk(patientIds, PATIENT_CHUNK_SIZE);
    const commonWell = new CommonWell(cwCert, cwKey, cwOrgName, oldCwOid, apiMode);

    let successCount = 0;
    let failureCount = 0;
    const failures: Record<string, string> = {};

    for (const [i, patients] of patientChunks.entries()) {
      console.log(`Chunk ${i + 1} of ${patientChunks.length}`);
      console.log(`# of patients ${patients.length}`);

      for (const patientId of patients) {
        const log = out(`Patient migration: cxId - ${cxId}, patientId - ${patientId}`).log;
        try {
          log("Resetting external data...");
          const resetUrl = `${apiUrl}/internal/patient/${patientId}/external-data`;
          await executeWithNetworkRetries(
            () =>
              axios.delete(resetUrl, {
                params: {
                  cxId,
                  source: MedicalDataSource.COMMONWELL,
                },
              }),
            {
              maxAttempts: NETWORK_RETRY_MAX_ATTEMPTS,
              initialDelay: NETWORK_RETRY_INITIAL_DELAY_MS,
              retryOnTimeout: NETWORK_RETRY_ON_TIMEOUT,
            }
          );

          log("Running patient discovery...");
          const pdUrl = `${apiUrl}/internal/commonwell/patient-discovery/${patientId}`;
          const pdParams = new URLSearchParams({
            cxId,
            rerunPdOnNewDemographics: rerunPdOnNewDemographics.toString(),
          });
          const resp = (await executeWithNetworkRetries(() => axios.post(`${pdUrl}?${pdParams}`), {
            maxAttempts: NETWORK_RETRY_MAX_ATTEMPTS,
            initialDelay: NETWORK_RETRY_INITIAL_DELAY_MS,
            retryOnTimeout: NETWORK_RETRY_ON_TIMEOUT,
          })) as PdResponse;
          log(`Request ID - ${JSON.stringify(resp.data.requestId)}`);

          log("Deleting patient in CommonWell...");
          const queryMeta = organizationQueryMeta(cwOrgName, {
            npi: orgNpi,
          });

          const cwPatientId = buildCWPatientId(oldCwOid, patientId);

          await executeWithNetworkRetries(() => commonWell.deletePatient(queryMeta, cwPatientId), {
            maxAttempts: NETWORK_RETRY_MAX_ATTEMPTS,
            initialDelay: NETWORK_RETRY_INITIAL_DELAY_MS,
            retryOnTimeout: NETWORK_RETRY_ON_TIMEOUT,
          });

          log("Patient migration completed successfully");
          successCount++;
        } catch (err) {
          log(`Failed to migrate patient: ${err}`);
          failures[patientId] = String(err);
          failureCount++;
        }
      }

      if (i < patientChunks.length - 1) {
        const sleepTime = getDelayTime({
          log,
          minimumDelayTime,
          defaultDelayTime: delayTime,
        });
        console.log(`Chunk ${i + 1} finished. Sleeping for ${sleepTime} ms...`);
        await sleep(sleepTime);
      }
    }

    console.log(`\nMigration summary:`);
    console.log(`Successfully migrated: ${successCount} patients`);
    console.log(`Failed to migrate: ${failureCount} patients`);

    if (failureCount > 0) {
      console.log("Failed patients:");
      Object.entries(failures).forEach(([patientId, error]) => {
        console.log(`- Patient ${patientId}: ${error}`);
      });
    }
  } catch (err) {
    const msg = "Patient migration failed.";
    console.log(`${msg}. Error - ${err}`);
  }
}

async function displayInitialWarningAndConfirmation(numberPatients: number) {
  console.log("\n\x1b[31m%s\x1b[0m\n", "---- ATTENTION - THIS IS NOT A SIMULATED RUN ----");
  console.log(
    `Migrating ${numberPatients} patients. CX: ${cxId}. CW OID: ${oldCwOid}. Sleeping ${confirmationTime.asMilliseconds()} ms before starting.`
  );
  await sleep(confirmationTime.asMilliseconds());
}

main();
