export interface SurescriptsVerifyRequestInHistoryHandler {
  verifyRequestInHistory({ transmissionId }: { transmissionId: string }): Promise<void>;
}
