import { PatientDemoData } from "../../../../domain/patient";

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ProcessPatientResult = {
  cxId: string;
  jobId: string;
};

export interface PatientImportResult {
  processJobResult(request: ProcessPatientResult): Promise<void>;
}
