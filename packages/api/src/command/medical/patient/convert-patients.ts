import { PatientData } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { PatientDataMPI } from "@metriport/core/mpi/patient";
import { createPatientUniqueId } from "@metriport/core/external/carequality/shared";

export function convertPatientDataToPatientDataMPI(sourcePatientData: PatientData): PatientDataMPI {
  return {
    ...sourcePatientData,
    id: "",
  };
}

export function convertPatientModelToPatientData(sourcePatientData: PatientModel): PatientDataMPI {
  const sourcePatientId = createPatientUniqueId(sourcePatientData.cxId, sourcePatientData.id);
  return {
    ...sourcePatientData.data,
    id: sourcePatientId,
  };
}
