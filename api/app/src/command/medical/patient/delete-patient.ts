import cwCommands from "../../../external/commonwell";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";

export type PatientDeleteCmd = BaseUpdateCmdWithCustomer & {
  facilityId: string;
};

export const deletePatient = async (patientDelete: PatientDeleteCmd): Promise<void> => {
  const { id, cxId, facilityId, eTag } = patientDelete;

  const patient = await getPatientOrFail({ id, cxId });
  validateVersionForUpdate(patient, eTag);

  try {
    // TODO: #393 move to declarative, event-based integration
    // Synchronous bc it needs to run after the Patient is deleted (it needs patient data from the DB)
    await cwCommands.patient.remove(patient, facilityId);

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // if its a 404, continue without surfacing the error, the patient is not in CW anyway
    if (err.response?.status !== 404) throw err;
    console.log(`Patient not found @ CW when deleting ${patient.id} , continuing...`);
  }

  await patient.destroy();
};
