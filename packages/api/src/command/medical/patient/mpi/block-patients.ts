import { GenderAtBirth } from "../../../../domain/medical/patient";
import { PatientModel } from "../../../../models/medical/patient";
import { Op, WhereOptions } from "sequelize";

// cxId is optional since we will use this code to also block patients for CQ
export type PatientBlock = {
  cxId?: string;
  facilityIds?: string[];
  data?: {
    dob?: string;
    genderAtBirth?: GenderAtBirth;
    firstNameInitial?: string;
    lastNameInitial?: string;
  };
};

export const blockPatients = async (criteria: Partial<PatientBlock>): Promise<PatientModel[]> => {
  const { data, ...restCriteria } = criteria;

  // Define a specific type for the whereClause
  const whereClause: WhereOptions = { ...restCriteria };

  if (data) {
    // Handling data criteria
    if (data.firstNameInitial) {
      whereClause["data.firstName"] = { [Op.like]: `${data.firstNameInitial}%` };
    }
    if (data.lastNameInitial) {
      whereClause["data.lastName"] = { [Op.like]: `${data.lastNameInitial}%` };
    }
    if (data.dob) {
      whereClause["data.dob"] = data.dob;
    }
    if (data.genderAtBirth) {
      whereClause["data.genderAtBirth"] = data.genderAtBirth;
    }
  }

  const patients = await PatientModel.findAll({
    where: whereClause,
  });

  return patients;
};
