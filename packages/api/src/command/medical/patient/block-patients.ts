import { Patient, PatientCreate, GenderAtBirth } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";

export type BlockData = {
  cxId?: string;
  facilityIds?: string[];
  data?: {
    dob?: string;
    genderAtBirth?: GenderAtBirth;
  };
};

export const blockPatients = async (criteria: Partial<PatientCreate>): Promise<Patient[]> => {
  const patients = await PatientModel.findAll({
    where: criteria,
  });

  return patients;
};
