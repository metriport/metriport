import { z } from "zod";

export const MEDICAL_ROSTER_ROUTE = "/internal/roster";

export type RosterParams = {
  rosterId: string;
  cxId: string;
};

export const rosterResponseSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  source: z.string(),
  type: z.string(),
  status: z.string(),
  data: z.unknown(),
});

export type RosterResponse = z.infer<typeof rosterResponseSchema>;

export const rostersResponseSchema = z.object({
  rosters: z.array(rosterResponseSchema),
});

export type RostersResponse = z.infer<typeof rostersResponseSchema>;
