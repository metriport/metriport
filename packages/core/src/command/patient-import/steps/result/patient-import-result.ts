import { PatientDemoData } from "../../../../domain/patient";

export type PatientPayload = PatientDemoData & { externalId: string | undefined };

export type ProcessPatientResult = {
  cxId: string;
  jobId: string;
  dryRun?: boolean;
};

export interface PatientImportResult {
  processPatientResult(request: ProcessPatientResult): Promise<void>;
}
