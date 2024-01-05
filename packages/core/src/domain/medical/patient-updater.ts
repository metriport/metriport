export abstract class PatientUpdater {
  public abstract updateAll(
    cxId: string,
    patientIds: string[]
  ): Promise<{ failedUpdateCount: number }>;
}
