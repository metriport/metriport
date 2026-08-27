import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
import { EmbedSources } from "../source";

dayjs.extend(duration);

export const embedDashSource = EmbedSources.embed as const;
export const defaultTokenDuration = dayjs.duration(10, "hours");
export const maxExpirationSeconds = defaultTokenDuration.asSeconds();

export const embedDashJwtTokenDataSchema = z.object({
  cxId: z.string(),
  practiceId: z.string(),
  source: z.literal(`${embedDashSource}`),
});
export type EmbedDashJwtTokenData = z.infer<typeof embedDashJwtTokenDataSchema>;

export const createEmbedTokenSchema = z.object({
  expirationInSeconds: z.number().int().positive().max(maxExpirationSeconds).optional(),
});
