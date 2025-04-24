/**
 * A mapping between a patient and a patient import job.
 */
export type PatientImportMapping = {
  id: string;
  cxId: string;
  patientId: string;
  /**
   * The row number of the patient in the CSV file
   */
  rowNumber: number;
  /**
   * The request ID of the data pipeline execution that created the patient and got its data
   */
  dataPipelineRequestId: string;
  jobId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PatientImportMappingCreate = Omit<PatientImportMapping, "createdAt" | "updatedAt">;
