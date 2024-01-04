import { Patient, PatientData } from "../domain/patient/patient";

export type PatientFind = Partial<Omit<Patient, "data">> & {
  data?: Partial<PatientData> & {
    firstNameInitial?: string;
    lastNameInitial?: string;
  };
};

export abstract class PatientFinder {
  public abstract find(data: PatientFind): Promise<Patient[]>;
}
