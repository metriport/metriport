export type Hl7Notification = {
  cxId: string;
  patientId: string;
  message: string;
  messageReceivedTimestamp: string;
  apiUrl?: string;
  bucketName?: string;
};

export interface Hl7NotificationWebhookSender {
  execute(request: Hl7Notification): Promise<void>;
}
