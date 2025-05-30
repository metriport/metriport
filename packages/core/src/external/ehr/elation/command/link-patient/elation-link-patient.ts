export type ProcessLinkPatientRequest = {
  cxId: string;
  practiceId: string;
  patientId: string;
};

export interface ElationLinkPatientHandler {
  processLinkPatient(request: ProcessLinkPatientRequest): Promise<void>;
}
