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
      // TODO: #393 move to declarative, event-based integration
      // Synchronous bc it needs to run after the Patient is deleted (it needs patient data from the DB)
      await Promise.allSettled([
        cwCommands.patient.remove(patient, facilityId).catch(err => {
          if (err.response?.status !== 404) throw err;
          console.log(`Patient not found @ CW when deleting ${patient.id} , continuing...`);
          processAsyncError(deleteContext);
        }),
        fhirApi.deleteResource("Patient", patient.id).catch(processAsyncError(deleteContext)),
        cqCommands.patient.remove(patient).catch(processAsyncError(deleteContext)),
      ]);

      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      capture.error(err, {
        extra: {
          context: deleteContext,
          patientId: patient.id,
          facilityId,
          options,
          err,
        },
      });
      throw err;
    }
    await patient.destroy();
  }
};
