import { Patient, PatientData } from "@metriport/core/domain/patient";
import { FindBySimilarity, GetOne, PatientLoader } from "@metriport/core/command/patient-loader";
import { Op, WhereOptions, json } from "sequelize";
import {
  getPatientOrFail,
  getPatientStates,
  PatientWithIdentifiers,
} from "../../command/medical/patient/get-patient";
import { PatientModel } from "../medical/patient";

/**
 * Implementation of the PatientLoader that executes the logic within the API (local).
 */
export class PatientLoaderLocal implements PatientLoader {
  public getStatesFromPatientIds(cxId: string, patientIds: string[]): Promise<string[]> {
    return getPatientStates({ cxId, patientIds });
  }

  async getOneOrFail({ id, cxId }: GetOne): Promise<PatientWithIdentifiers> {
    const patient = await getPatientOrFail({ id, cxId });
    console.log("patient-loader-local", patient);
    return patient;
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
    const whereDataClause: WhereOptions<PatientData> = {
      ...(patient.data.firstNameInitial
        ? { firstName: { [Op.like]: `${patient.data.firstNameInitial}%` } }
        : undefined),
      ...(patient.data.lastNameInitial
        ? { lastName: { [Op.like]: `${patient.data.lastNameInitial}%` } }
        : undefined),
      // Confirmed this is needed: https://github.com/sequelize/sequelize/issues/5155#issuecomment-417242643
      ...(patient.data.dob
        ? {
            [Op.and]: [json("data->>'dob'", patient.data.dob)],
          }
        : undefined),
      ...(patient.data.genderAtBirth ? { genderAtBirth: patient.data.genderAtBirth } : undefined),
    };
    const whereClause: WhereOptions<PatientModel> = {
      ...(patient.cxId !== undefined && { cxId: patient.cxId }),
      ...(Object.keys(whereDataClause).length > 0 && { data: whereDataClause }),
    };
    if (Object.keys(whereClause).length === 0) throw new Error("No search criteria provided");

    const patients = await PatientModel.findAll({ where: whereClause });
    return patients.map(patient => patient.dataValues);
  }
}
