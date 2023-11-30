export abstract class PatientLoader {
  public abstract getStatesFromPatientIds(cxId: string, patientIds: string[]): Promise<string[]>;
}
