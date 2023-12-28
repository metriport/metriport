import { PatientModel } from "../../../../models/medical/patient";
import { Op, WhereOptions } from "sequelize";
import { convertPatientModelToPatientData } from "./convert-patients";
import { PatientDataMPI } from "@metriport/core/external/mpi/patient";
import { PatientBlock, PatientBlocker } from "@metriport/core/external/mpi/patient-blocker";

export class AppPatientBlocker extends PatientBlocker {
  async block(params: PatientBlock): Promise<PatientDataMPI[]> {
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
    return patients.map(convertPatientModelToPatientData);
  }
}
