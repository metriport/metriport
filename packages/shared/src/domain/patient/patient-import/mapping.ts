import { BaseDomain, BaseDomainCreate } from "../../base-domain";

export interface PatientImportMappingCreate extends BaseDomainCreate {
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
}

/**
 * A mapping between a patient and a patient import job.
 */
export interface PatientImportMapping extends BaseDomain, PatientImportMappingCreate {}
