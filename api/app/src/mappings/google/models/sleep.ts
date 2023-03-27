import { z } from "zod";

const sessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startTimeMillis: z.string(),
  endTimeMillis: z.string(),
  modifiedTimeMillis: z.string(),
  application: z.object({
    packageName: z.string(),
    version: z.string(),
    detailsUrl: z.string(),
  }),
  activityType: z.number(),
});

export const googleSleepResp = z.object({
  session: z.array(sessionSchema),
  deletedSession: z.array(sessionSchema),
});

export type GoogleSleep = z.infer<typeof googleSleepResp>;
