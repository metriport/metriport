import { z } from "zod";

export const questSource = "quest";

export const QUEST_EXTERNAL_ID_REGEX = /^[A-Z0-9]{15}$/;
export const questMappingRequestSchema = z.object({
  externalId: z.string().regex(QUEST_EXTERNAL_ID_REGEX),
});
