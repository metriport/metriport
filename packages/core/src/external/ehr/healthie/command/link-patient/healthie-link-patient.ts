export type ProcessLinkPatientRequest = {
  cxId: string;
  practiceId: string;
  patientId: string;
};

export interface HealthieLinkPatientHandler {
  processLinkPatient(request: ProcessLinkPatientRequest): Promise<void>;
}
