import { AtLeastOne } from "@metriport/shared/common/types";
import { Patient, PatientData } from "../domain/patient";

export type GetOne = Pick<Patient, "id" | "cxId">;

export type FindBySimilarity = Pick<Patient, "cxId"> & {
  data: AtLeastOne<
    Partial<Pick<PatientData, "dob" | "genderAtBirth">> & {
      firstNameInitial?: string;
      lastNameInitial?: string;
    }
  >;
};

export interface PatientLoader {
  getStatesFromPatientIds(cxId: string, patientIds: string[]): Promise<string[]>;

  getOneOrFail<T extends Patient>(params: GetOne): Promise<T>;

  /**
   * Finds patients that match the given criteria ACROSS ALL CUSTOMERS. This is to be used only on
   * the context of MPI searching across all customers.
   *
   * When searching patients within a specific customer, use `findBySimilarity`.
   */
  findBySimilarityAcrossAllCxs<T extends Patient>(
    params: Omit<FindBySimilarity, "cxId">
  ): Promise<T[]>;

  findBySimilarity<T extends Patient>(params: FindBySimilarity): Promise<T[]>;
}
