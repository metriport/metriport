import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { initApiForExistingOrg } from "../flows/org-management";

const patientId: string = process.argv[2]; // read patient ID from command line argument

/**
 * Utility to delete a patient from CommonWell.
 *
 * Used in case the cert flow breaks and we don't delete the patient.
 *
 * Usage:
 * - Set env vars - see README.md for details
 * - Run the command
 *   $ ts-node src/single-commands/patient-delete.ts <patient-id>
 */
export async function deletePatient() {
  if (!patientId || patientId.trim().length < 1) {
    throw new Error("No patientId provided. Add it as an argument to the command");
  }
  const { commonWell } = await initApiForExistingOrg();

  const encodedPatientId = encodeToCwPatientId({
    patientId: patientId,
    assignAuthority: commonWell.oid,
  });
  console.log(`Delete Patient ${patientId}`);
  await commonWell.deletePatient(encodedPatientId);
  console.log(`Patient deleted successfully`);
}

deletePatient();
