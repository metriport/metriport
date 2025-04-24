export type Hl7Notification = {
  cxId: string;
  patientId: string;
  message: string;
  messageReceivedTimestamp: string;
};

export type Hl7NotificationProps = Hl7Notification & {
  apiUrl: string;
  bucketName: string;
};

export interface Hl7NotificationWebhookSender {
  execute(request: Hl7NotificationProps): Promise<void>;
}
