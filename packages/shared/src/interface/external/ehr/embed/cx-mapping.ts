import { z } from "zod";

export const embedSecondaryMappingsSchema = z.object({});
export type EmbedSecondaryMappings = z.infer<typeof embedSecondaryMappingsSchema>;
