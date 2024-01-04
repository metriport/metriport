import { Patient } from "../domain/patient/patient";

export abstract class MPI {
  public abstract findMatchingPatient(
    patient: Patient,
    cxId?: string
  ): Promise<Patient | undefined>;
}
