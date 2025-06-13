export interface SurescriptsReceiveVerificationHandler {
  receiveVerification({ transmissionId }: { transmissionId: string }): Promise<void>;
}
