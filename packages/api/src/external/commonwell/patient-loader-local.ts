import { Patient, PatientData } from "@metriport/core/domain/patient";
import { FindBySimilarity, GetOne, PatientLoader } from "@metriport/core/command/patient-loader";
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
    const whereClause: WhereOptions = {};

    if (patient.cxId !== undefined) {
      whereClause.cxId = patient.cxId;
    }

    // Explicitly pick each key as a key of PatientData
    const firstNameKey: keyof Pick<PatientData, "firstName"> = "firstName";
    const lastNameKey: keyof Pick<PatientData, "lastName"> = "lastName";
    const dobKey: keyof Pick<PatientData, "dob"> = "dob";
    const genderAtBirthKey: keyof Pick<PatientData, "genderAtBirth"> = "genderAtBirth";

    if (patient.data.firstNameInitial) {
      whereClause[`data.${firstNameKey}`] = { [Op.like]: `${patient.data.firstNameInitial}%` };
    }
    if (patient.data.lastNameInitial) {
      whereClause[`data.${lastNameKey}`] = { [Op.like]: `${patient.data.lastNameInitial}%` };
    }
    if (patient.data.dob) {
      whereClause[`data.${dobKey}`] = patient.data.dob;
    }
    if (patient.data.genderAtBirth) {
      whereClause[`data.${genderAtBirthKey}`] = patient.data.genderAtBirth;
    }

    const patients = await PatientModel.findAll({ where: whereClause });
    return patients;
  }
}
