export interface SurescriptsReceiveResponseHandler {
  receiveResponse({ transmissionId }: { transmissionId: string }): Promise<void>;
}
