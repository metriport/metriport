import z from "zod";

export const whoopScoreSchema = z.enum(["SCORED", "PENDING_SCORE", "UNSCORABLE"]);

export type WhoopScore = z.infer<typeof whoopScoreSchema>;
