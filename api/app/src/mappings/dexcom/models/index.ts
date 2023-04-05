import { z } from "zod";

export const dexcomResp = z.object({
  recordType: z.string(),
  recordVersion: z.string(),
  userId: z.string(),
});

export const baseRecordSchema = z.object({
  systemTime: z.string(),
  displayTime: z.string(),
  recordId: z.string(),
  displayDevice: z.string(),
  transmitterGeneration: z.string(),
});
