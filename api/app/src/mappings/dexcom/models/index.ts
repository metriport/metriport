import { z } from "zod";

export const dexcomResp = z.object({
  recordType: z.string(),
  recordVersion: z.string(),
  userId: z.string(),
});
