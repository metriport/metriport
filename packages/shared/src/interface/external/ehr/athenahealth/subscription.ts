import { z } from "zod";

export type FeedType = "appointments";

export type EventType = "ScheduleAppointment";

export const createdSubscriptionSchema = z.object({
  success: z.boolean(),
});
export type CreatedSubscription = z.infer<typeof createdSubscriptionSchema>;
export const createdSubscriptionSuccessSchema = z.object({
  success: z.literal(true),
});
export type CreatedSubscriptionSuccess = z.infer<typeof createdSubscriptionSuccessSchema>;
