export interface WebhookStatusResponse {
  webhookEnabled: boolean;
  webhookStatusDetail?: string;
  webhookRequestsProcessing: number;
  webhookRequestsFailed: number;
}
