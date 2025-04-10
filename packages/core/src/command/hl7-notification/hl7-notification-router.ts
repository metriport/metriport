export type Hl7Notification = {
  cxId: string;
  patientId: string;
  message: string;
  messageReceivedTimestamp: string;
};

export interface Hl7NotificationRouter {
  execute(request: Hl7Notification): Promise<void>;
}
