import cwCommands from "../../../external/commonwell";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";
import { Config } from "../../../shared/config";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { capture } from "../../../shared/notifications";

export type PatientDeleteCmd = BaseUpdateCmdWithCustomer & {
  facilityId: string;
};

export const deletePatient = async (patientDelete: PatientDeleteCmd): Promise<void> => {
  const { id, cxId, facilityId, eTag } = patientDelete;

  const patient = await getPatientOrFail({ id, cxId });
  validateVersionForUpdate(patient, eTag);

  if (Config.isSandbox()) {
    const fhirApi = makeFhirApi(cxId);

    try {
      // TODO: #393 move to declarative, event-based integration
      // Synchronous bc it needs to run after the Patient is deleted (it needs patient data from the DB)
      await cwCommands.patient.remove(patient, facilityId);
      await fhirApi.deleteResource("Patient", patient.id);
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // if its a 404, continue without surfacing the error, the patient is not in CW anyway
      if (err.response?.status !== 404) throw err;
      console.log(`Patient not found @ CW when deleting ${patient.id} , continuing...`);

      capture.error(err, {
        extra: {
          context: `cw.deletePatient`,
          patientId: patient.id,
        },
      });
    }
    await patient.destroy();
  }
};
