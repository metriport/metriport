import { z } from "zod";

export const hl7NotificationSenderParamsSchema = z.object({
  cxId: z.string().uuid(),
  patientId: z.string().uuid(),
  message: z.string(),
  messageReceivedTimestamp: z.string(),
  hieName: z.string(),
  impersonationTimezone: z.string().optional(),
});

export type Hl7NotificationSenderParams = z.infer<typeof hl7NotificationSenderParamsSchema>;

export interface Hl7NotificationWebhookSender {
  execute(request: Hl7NotificationSenderParams): Promise<void>;
}
