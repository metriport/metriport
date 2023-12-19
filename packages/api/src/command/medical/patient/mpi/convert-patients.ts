import { PatientData } from "../../../../domain/medical/patient";
import { PatientModel } from "../../../../models/medical/patient";
import { PatientDataMPI } from "@metriport/core/src/external/mpi/patient-incoming-schema";

export function convertPatientDataToPatientDataMPI(patientData1: PatientData): PatientDataMPI {
  const patientData2: PatientDataMPI = {
    ...patientData1,
    id: "",
  };

  return patientData2;
}

export function convertPatientModelToPatientData(patientModel: PatientModel): PatientDataMPI {
  const patientData2: PatientDataMPI = {
    ...patientModel.data,
    id: patientModel.id,
  };

  return patientData2;
}
