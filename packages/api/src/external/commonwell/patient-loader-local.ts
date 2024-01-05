import { Patient } from "@metriport/core/domain/medical/patient";
import {
  FindBySimilarity,
  GetOne,
  PatientLoader,
} from "@metriport/core/domain/medical/patient-loader";
import { Op, WhereOptions } from "sequelize";
import { getPatientOrFail, getPatientStates } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";

/**
 * Implementation of the PatientLoader that executes the logic within the API (local).
 */
export class PatientLoaderLocal implements PatientLoader {
  public getStatesFromPatientIds(cxId: string, patientIds: string[]): Promise<string[]> {
    return getPatientStates({ cxId, patientIds });
  }

  async getOneOrFail({ id, cxId }: GetOne): Promise<Patient> {
    return getPatientOrFail({ id, cxId });
  }

  /**
   * Finds patients that match the given criteria ACROSS ALL CUSTOMERS. This is to be used only on
   * the context of MPI searching across all customers.
   *
   * When searching patients within a specific customer, use `findBySimilarity`.
   */
  async findBySimilarityAcrossAllCxs(patient: Omit<FindBySimilarity, "cxId">): Promise<Patient[]> {
    return this.findBySimilarityInternal(patient);
  }

  async findBySimilarity(patient: FindBySimilarity): Promise<Patient[]> {
    return this.findBySimilarityInternal(patient);
  }

  private async findBySimilarityInternal(
    patient: Partial<Pick<FindBySimilarity, "cxId">> & Omit<FindBySimilarity, "cxId">
  ): Promise<Patient[]> {
    // Define a specific type for the whereClause
    const whereClause: WhereOptions = {};

    // Only add cxId to whereClause if it is not undefined
    if (patient.cxId !== undefined) {
      whereClause.cxId = patient.cxId;
    }

    // Handling data criteria
    if (patient.data.firstNameInitial) {
      whereClause["data.firstName"] = { [Op.like]: `${patient.data.firstNameInitial}%` };
    }
    if (patient.data.lastNameInitial) {
      whereClause["data.lastName"] = { [Op.like]: `${patient.data.lastNameInitial}%` };
    }
    if (patient.data.dob) {
      whereClause["data.dob"] = patient.data.dob;
    }
    if (patient.data.genderAtBirth) {
      whereClause["data.genderAtBirth"] = patient.data.genderAtBirth;
    }

    const patients = await PatientModel.findAll({ where: whereClause });
    return patients;
  }
}
