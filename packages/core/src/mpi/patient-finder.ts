import { GenderAtBirth, PatientDataMPI } from "./patient";

export type PatientFind = {
  cxId?: string;
  facilityIds?: string[];
  data?: {
    dob?: string;
    genderAtBirth?: GenderAtBirth;
    firstNameInitial?: string;
    lastNameInitial?: string;
  };
};

export abstract class PatientFinder {
  public abstract find(data: PatientFind): Promise<PatientDataMPI[]>;
}
