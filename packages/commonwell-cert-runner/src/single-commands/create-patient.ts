import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { Demographics, Patient } from "@metriport/commonwell-sdk";
import { initApiForExistingOrg } from "../flows/org-management";
import { makePatient } from "../payloads";
import { patientTracyCrane } from "../payloads/patient-crane";
import { getMetriportPatientIdOrFail } from "../util";

// Set one of the patient demographics from "../payloads" here
const patientDemo: Omit<Demographics, "identifier"> = patientTracyCrane;

/**
 * Supporting function used to create a patient.
 */
export async function createPatient() {
  if (!patientDemo) {
    throw new Error("No patient demographics set, this is required");
  }
  const { commonWell } = await initApiForExistingOrg();

  console.log(`Create Patient`);
  const patientCreate: Patient = makePatient({
    facilityId: commonWell.oid,
    demographics: patientDemo,
  });
  const resp = await commonWell.createOrUpdatePatient(patientCreate);
  console.log("Transaction ID: " + commonWell.lastTransactionId);
  console.log("Response: " + JSON.stringify(resp, null, 2));
  const patientId = getMetriportPatientIdOrFail(resp.Patients[0], "createPatient");
  console.log("Patient ID: " + patientId);
}

createPatient();
