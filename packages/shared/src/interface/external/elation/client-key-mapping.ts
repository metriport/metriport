import { z } from "zod";

export const elationDataSchema = z.object({
  webhookPubKey: z.string(),
});
export type ElationData = z.infer<typeof elationDataSchema>;
