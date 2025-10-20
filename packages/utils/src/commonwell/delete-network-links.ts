import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { APIMode, CommonWell, getPersonIdFromUrl, Patient } from "@metriport/commonwell-sdk-v1";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { makeDir } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { PurposeOfUse, sleep } from "@metriport/shared";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as fs from "fs";
import path from "path";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { getCxData } from "../shared/get-cx-data";
import { logNotDryRun } from "../shared/log";

dayjs.extend(duration);

/**
 * TODO: move this to an endpoint in the API
 *
 * This script will downgrade all network links for the given patients, from LOLA 2 to LOLA 0,
 * essentially preventing them from ever being used again.
 *
 * This is a destructive operation and should be used with caution!
 *
 * This script will get the information below and save it to the output folder:
 * - Patient demographics
 * - Patient's person
 * - Patient's network links
 * Then it will delete the network links (if not dryrun).
 *
 * Output folder: `runs/delete-link/<orgName-with-timestamp>/<patientId>`
 *
 * To run:
 * - Set the env vars in the .env file.
 * - Update the `cwApiMode` constant to the desired mode.
 * - Update the `patientIds` array with the patients you want to downgrade.
 * - Either:
 *   - `ts-node utils/commonwell/delete-link --dryrun`
 *   - `ts-node utils/commonwell/delete-link`
 */
const cwApiMode = APIMode.integration;
/**
 * List of patients to downgrade the network links.
 */
const patientIds: string[] = [];

const pathToCerts = getEnvVarOrFail("ORG_CERTS_FOLDER");
const cxId = getEnvVarOrFail("CX_ID");

const cert = fs.readFileSync(`${pathToCerts}/cert1.pem`, "utf8");
const privkey = fs.readFileSync(`${pathToCerts}/privkey1.pem`, "utf8");

const confirmationTime = dayjs.duration(10, "seconds");
const getOutputFileName = buildGetDirPathInside(`delete-network-links`);

type Params = {
  dryrun?: boolean;
};
const program = new Command();
program
  .name("delete-network-links")
  .description("CLI to downgrade all network links for multiple patients.")
  .option(`--dryrun`, "Just simulate without actually downgrading them.")
  .showHelpAfterError();

async function main() {
  initRunsFolder();
  program.parse();
  const { dryrun: dryRunParam } = program.opts<Params>();
  const dryRun = dryRunParam ?? false;
  const { log } = out(dryRun ? "DRY-RUN" : "");

  const startedAt = Date.now();
  log(`>>> Starting with ${patientIds.length} patient IDs...`);

  const { npi, orgName, orgOID } = await getCxData(cxId);
  const baseFolderName = getOutputFileName(orgName);

  const cwApi = new CommonWell(cert, privkey, orgName, "urn:oid:" + orgOID, cwApiMode);
  const base = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${orgName} System User`,
  };
  const queryMeta = {
    subjectId: base.subjectId,
    role: base.role,
    purposeOfUse: base.purposeOfUse,
    npi: npi,
  };

  await displayWarningAndConfirmation(orgName, patientIds.length, dryRun, log);

  log(`>>> Running for total ${patientIds.length} patients...`);
  for (const patientId of patientIds) {
    log(`>>> Now checking patient ${patientId}...`);
    const cwPatientId = buildCWPatientId(orgOID, patientId);
    const patientFolderName = path.join(baseFolderName, patientId);

    log(`>>> Getting patient demographics...`);
    const cwPatient = await cwApi.getPatient(queryMeta, cwPatientId);
    saveResponse(cwPatient, "patient.json", patientFolderName);

    log(`>>> Getting patient's person...`);
    const cwPersonId = getPersonId(cwPatient);
    if (cwPersonId) {
      const cwPerson = await cwApi.getPersonById(queryMeta, cwPersonId);
      saveResponse(cwPerson, "person.json", patientFolderName);
    } else {
      error(`>>> No person found for patient ${patientId}`);
    }

    log(`>>> Getting patient network links...`);
    const links = await cwApi.getNetworkLinks(queryMeta, cwPatientId);
    saveResponse(links, "network-links.json", patientFolderName);

    const networkLinks = (links._embedded.networkLink ?? []).flatMap(l => (l != null ? l : []));
    const numLinks = networkLinks.length;
    if (numLinks < 1) {
      warn(`>>> No network links found for patient, moving on...`);
      continue;
    }
    for (const networkLink of networkLinks) {
      const downgradeLink = networkLink._links?.downgrade?.href;
      if (!downgradeLink) {
        error(`>>> No downgrade link found for patient ${patientId}, network link: ${networkLink}`);
        continue;
      }
      if (dryRun) {
        log(`>>> Would have deleted patient link ${downgradeLink}...`);
        continue;
      }
      log(`>>> Deleting patient link ${downgradeLink}...`);
      await cwApi.deletePatientLink(queryMeta, downgradeLink);
    }
  }
  log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  process.exit(0);
}

function getPersonId(patient: Patient | undefined): string | undefined {
  if (!patient) return undefined;
  const url = patient._links?.person?.href;
  return getPersonIdFromUrl(url);
}

async function displayWarningAndConfirmation(
  orgName: string,
  patientCount: number,
  dryRun: boolean,
  log: typeof console.log
) {
  const msg = `You are about to downgrade ALL network links for ${patientCount} patients of the org/cx ${orgName}...`;
  if (dryRun) {
    log(msg);
    return;
  }
  logNotDryRun(log);
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

function buildCWPatientId(orgOID: string, patientId: string): string {
  return `${patientId}%5E%5E%5Eurn%3aoid%3a${orgOID}`;
}

function saveResponse(payload: unknown, fileName: string, dirName: string) {
  // log(`>>> Response:`);
  // log(JSON.stringify(payload, null, 2));
  makeDir(dirName);
  fs.writeFileSync(`${dirName}/${fileName}`, JSON.stringify(payload, null, 2));
}

function warn(...args: unknown[]) {
  console.log("WARN ", ...args);
}
function error(...args: unknown[]) {
  console.log("ERROR ", ...args);
}

main();
