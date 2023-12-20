import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { validateVersionForUpdate } from "../../../models/_default";
import { Config } from "../../../shared/config";
import { capture } from "../../../shared/notifications";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";

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
      const results = await Promise.allSettled([
        cwCommands.patient.remove(patient, facilityId),
        fhirApi.deleteResource("Patient", patient.id),
        cqCommands.patient.remove(patient),
      ]);

      results.forEach(result => {
        if (result.status === "rejected") {
          throw result.reason;
        }
      });

      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // if its a 404, continue without surfacing the error, the patient is not in CW anyway
      if (err.response?.status !== 404) throw err;
      console.log(`Patient not found @ CW when deleting ${patient.id} , continuing...`);

      capture.error(err, {
        extra: {
          context: `cw.deletePatient`,
          patientId: patient.id,
          facilityId,
          options,
          err,
        },
      });
    }
    await patient.destroy();
  }
};
