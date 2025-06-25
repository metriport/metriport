// keep that ^ above all other imports
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { initApiForExistingOrg } from "../flows/org-management";

const patientId: string = process.argv[2]; // read patient ID from command line argument

/**
 * Supporting function used to get a patient by ID.
 */
export async function getPatient() {
  if (!patientId || patientId.trim().length < 1) {
    throw new Error("No patientId provided. Add it as an argument to the command");
  }
  const { commonWell, orgQueryMeta } = await initApiForExistingOrg();

  const encodedPatientId = encodeToCwPatientId({
    patientId: patientId,
    assignAuthority: commonWell.oid,
  });

  console.log(`Get Patient ${patientId}`);
  const resp = await commonWell.getPatient(orgQueryMeta, encodedPatientId);
  console.log("Transaction ID: " + commonWell.lastTransactionId);
  console.log("Response: " + JSON.stringify(resp, null, 2));
}

getPatient();
