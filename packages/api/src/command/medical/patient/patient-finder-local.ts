import { PatientModel } from "../../../models/medical/patient";
import { Op, WhereOptions } from "sequelize";
import { Patient } from "../../../domain/medical/patient";
import { PatientFind, PatientFinder } from "@metriport/core/mpi/patient-finder";

export class PatientFinderLocal extends PatientFinder {
  async find(params: PatientFind): Promise<Patient[]> {
    const { data, ...restCriteria } = params;

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
  }
}
