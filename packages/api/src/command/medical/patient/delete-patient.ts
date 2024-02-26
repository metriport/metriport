import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import { processAsyncError } from "../../../errors";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { validateVersionForUpdate } from "../../../models/_default";
import { Config } from "../../../shared/config";
import { capture } from "../../../shared/notifications";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";

const deleteContext = "cw.patient.delete";

export type PatientDeleteCmd = BaseUpdateCmdWithCustomer & {
  facilityId?: string;
};

export type DeleteOptions = {
  allEnvs?: boolean;
};

export const deletePatient = async (
  patientDelete: PatientDeleteCmd,
  options: DeleteOptions = {}
): Promise<void> => {
  const { id, cxId, facilityId: facilityIdParam, eTag } = patientDelete;

  const patient = await getPatientOrFail({ id, cxId });
  validateVersionForUpdate(patient, eTag);

  const facilityId = getFacilityIdOrFail(patient, facilityIdParam);

  if (options.allEnvs || Config.isSandbox()) {
    const fhirApi = makeFhirApi(cxId);

    try {
      // These need to run before the Patient is deleted (need patient data from the DB)
      await Promise.all([
        cwCommands.patient.remove(patient, facilityId).catch(err => {
          if (err.response?.status !== 404) throw err;
          console.log(`Patient not found @ CW when deleting ${patient.id} , continuing...`);
          processAsyncError(deleteContext);
        }),
        fhirApi.deleteResource("Patient", patient.id).catch(processAsyncError(deleteContext)),
        cqCommands.patient.remove(patient).catch(processAsyncError(deleteContext)),
      ]);
      await patient.destroy();
    } catch (error) {
      capture.error("Failed to delete patient", {
        extra: {
          context: deleteContext,
          patientId: patient.id,
          facilityId,
          options,
          error,
        },
      });
      throw error;
    }
  }
};
