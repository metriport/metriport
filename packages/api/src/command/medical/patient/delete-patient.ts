import { capture } from "@metriport/core/util/notifications";
import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import { processAsyncError } from "../../../errors";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { validateVersionForUpdate } from "../../../models/_default";
import { deleteAllPatientMappings } from "../../mapping/patient";
import { deleteAllResourceMappingReverseds } from "../../mapping/resource-reversed";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientModelOrFail } from "./get-patient";
import { deletePatientSettings } from "./settings/delete-patient-settings";

const deleteContext = "cw.patient.delete";

export type PatientDeleteCmd = BaseUpdateCmdWithCustomer & {
  facilityId?: string;
};

export type DeleteOptions = {
  allEnvs?: boolean;
};

export const deletePatient = async (patientDelete: PatientDeleteCmd): Promise<void> => {
  const { id, cxId, facilityId: facilityIdParam, eTag } = patientDelete;

  const patient = await getPatientModelOrFail({ id, cxId });
  validateVersionForUpdate(patient, eTag);

  const facilityId = getFacilityIdOrFail(patient, facilityIdParam);
  const fhirApi = makeFhirApi(cxId);

  try {
    // These need to run before the Patient is deleted (need patient data from the DB)
    await Promise.all([
      cwCommands.patient.remove(patient, facilityId).catch(err => {
        if (err.response?.status === 404) {
          console.log(`Patient not found @ CW when deleting ${patient.id} , continuing...`);
          return;
        }
        processAsyncError(deleteContext)(err);
      }),
      fhirApi.deleteResource("Patient", patient.id).catch(processAsyncError(deleteContext)),
      cqCommands.patient.remove(patient).catch(processAsyncError(deleteContext)),
      deleteAllPatientMappings({ cxId, patientId: id }),
      deleteAllResourceMappingReverseds({ cxId, patientId: id }),
      deletePatientSettings({ cxId, patientId: id }),
    ]);
    await patient.destroy();
  } catch (error) {
    capture.error("Failed to delete patient", {
      extra: {
        context: deleteContext,
        patientId: patient.id,
        facilityId,
        error,
      },
    });
    throw error;
  }
};
