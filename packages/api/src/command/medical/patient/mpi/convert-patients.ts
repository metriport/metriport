import { PatientData } from "../../../../domain/medical/patient";
import { PatientModel } from "../../../../models/medical/patient";
import { PatientDataMPI } from "@metriport/core/src/external/mpi/patient-incoming-schema";

export function convertPatientDataToPatientDataMPI(sourcePatientData: PatientData): PatientDataMPI {
  return {
    ...sourcePatientData,
    id: "",
  };
}

export function convertPatientModelToPatientData(sourcePatientData: PatientModel): PatientDataMPI {
  return {
    ...sourcePatientData.data,
    id: sourcePatientData.id,
  };
}
