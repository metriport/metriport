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
import { addOidPrefix } from "@metriport/core/domain/oid";

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
 *  - CW_OID (the old OID to use for deletion)
 *  - CW_CERT (the CommonWell certificate)
 *  - CW_KEY (the CommonWell private key)
 *  - CW_ORG_NAME (the name of the organization)
 * 2. Set the patientIds
 * 3. Run the script with `ts-node src/commonwell/migrate-patients.ts`
 */

dayjs.extend(duration);

const patientIds: string[] = [];
const rerunPdOnNewDemographics = false;
const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");

const cwOid = getEnvVarOrFail("CW_OID");
const cwCert = getEnvVarOrFail("CW_CERT");
const cwKey = getEnvVarOrFail("CW_KEY");
const apiMode = APIMode.integration;

const PATIENT_CHUNK_SIZE = 2;

const oldCwOid = "";
const cwOrgName = "";

const confirmationTime = dayjs.duration(10, "seconds");
const delayTime = dayjs.duration(10, "seconds");

type PdResponse = {
  data: {
    requestId: string;
  };
};

function buildCWPatientId(orgOID: string, patientId: string): string {
  return `${patientId}%5E%5E%5Eurn%3aoid%3a${orgOID}`;
}

async function main() {
  try {
    await displayInitialWarningAndConfirmation(patientIds.length);

    const patientChunks = chunk(patientIds, PATIENT_CHUNK_SIZE);
    const commonWell = new CommonWell(cwCert, cwKey, cwOrgName, oldCwOid, apiMode);

    for (const [i, patients] of patientChunks.entries()) {
      console.log(`Chunk ${i + 1} of ${patientChunks.length}`);
      console.log(`# of patients ${patients.length}`);

      for (const patientId of patients) {
        const log = out(`Patient migration: cxId - ${cxId}, patientId - ${patientId}`).log;

        log("Resetting external data...");
        const resetUrl = `${apiUrl}/internal/patient/${patientId}/external-data`;
        await axios.put(resetUrl, null, {
          params: {
            cxId,
            source: MedicalDataSource.COMMONWELL,
          },
        });

        log("Running patient discovery...");
        const pdUrl = `${apiUrl}/internal/commonwell/patient-discovery/${patientId}`;
        const pdParams = new URLSearchParams({
          cxId,
          rerunPdOnNewDemographics: rerunPdOnNewDemographics.toString(),
        });
        const resp = (await axios.post(`${pdUrl}?${pdParams}`)) as PdResponse;
        log(`Request ID - ${JSON.stringify(resp.data.requestId)}`);

        // 3. Delete patient in CommonWell
        log("Deleting patient in CommonWell...");
        const queryMeta = organizationQueryMeta(cwOrgName, {
          npi: addOidPrefix(oldCwOid),
        });

        const cwPatientId = buildCWPatientId(oldCwOid, patientId);

        await commonWell.deletePatient(queryMeta, cwPatientId);

        log("Patient migration completed successfully");
      }

      if (i < patientChunks.length - 1) {
        const sleepTime = delayTime.asMilliseconds();
        console.log(`Chunk ${i + 1} finished. Sleeping for ${sleepTime} ms...`);
        await sleep(sleepTime);
      }
    }
  } catch (err) {
    const msg = "Patient migration failed.";
    console.log(`${msg}. Error - ${err}`);
  }
}

async function displayInitialWarningAndConfirmation(numberPatients: number) {
  console.log("\n\x1b[31m%s\x1b[0m\n", "---- ATTENTION - THIS IS NOT A SIMULATED RUN ----"); // https://stackoverflow.com/a/41407246/2099911
  console.log(
    `Migrating ${numberPatients} patients. CX: ${cxId}. CW OID: ${cwOid}. Sleeping ${confirmationTime.asMilliseconds()} ms before starting.`
  );
  await sleep(confirmationTime.asMilliseconds());
}

main();
