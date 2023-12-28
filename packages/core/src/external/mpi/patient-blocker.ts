import { GenderAtBirth, PatientDataMPI } from "./patient";

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

export abstract class PatientBlocker {
  abstract block(data: PatientBlock): Promise<PatientDataMPI[]>;
}

export function makeBlockerFactory(blockerType: new () => PatientBlocker): PatientBlocker {
  return new blockerType();
}
