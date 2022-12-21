import { z } from "zod";

export const streamingDataSchema = z.object({
  interval: z.number(),
  items: z.array(z.any()),
  timestamp: z.string(),
});
