import { z } from "zod";
import { subscriptionResources } from "./subscription";

const webHookSchema = z.object({
  url: z.string(),
  signingKey: z.string(),
});

export const elationSecondaryMappingsSchema = z.object({
  webHooks: z.record(z.enum(subscriptionResources), webHookSchema).optional(),
});
export type ElationSecondaryMappings = z.infer<typeof elationSecondaryMappingsSchema>;
