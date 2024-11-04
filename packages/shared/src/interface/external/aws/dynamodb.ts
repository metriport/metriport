import { z } from "zod";

export const settingsEntry = z.object({
  requestsPerSecond: z.object({
    N: z.number(),
  }),
});
