import { z } from "zod";

export type FeedType = "appointments";

export type EventType = "ScheduleAppointment";

export const subscriptionCreateResponseSchema = z.object({
  success: z.boolean(),
});
