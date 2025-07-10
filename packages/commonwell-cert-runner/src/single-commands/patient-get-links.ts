import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { initApiForExistingOrg } from "../flows/org-management";

const patientId: string = process.argv[2]; // read patient ID from command line argument

/**
 * Utility to get links for a patient by ID.
 *
 * Usage:
 * - Set env vars - see README.md for details
 * - Run the command
 *   $ ts-node src/single-commands/patient-get-links.ts <patient-id>
 */
export async function getPatientLinks() {
  if (!patientId || patientId.trim().length < 1) {
    throw new Error("No patientId provided. Add it as an argument to the command");
  }
  const { commonWell } = await initApiForExistingOrg();

  const encodedPatientId = encodeToCwPatientId({
    patientId: patientId,
    assignAuthority: commonWell.oid,
  });

  console.log(`Get Patient Links for ${patientId}`);
  const resp = await commonWell.getPatientLinksByPatientId(encodedPatientId);
  console.log("Transaction ID: " + commonWell.lastTransactionId);
  console.log("Response: " + JSON.stringify(resp, null, 2));
}

getPatientLinks();
