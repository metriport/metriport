import { Patient, GenderAtBirth } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";

export type PatientBlock = {
  cxId?: string;
  facilityIds?: string[];
  data?: {
    dob?: string;
    genderAtBirth?: GenderAtBirth;
  };
};

export const blockPatients = async (criteria: Partial<PatientBlock>): Promise<Patient[]> => {
  const patients = await PatientModel.findAll({
    where: criteria,
  });

  return patients;
};
