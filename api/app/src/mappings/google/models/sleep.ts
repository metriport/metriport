import { z } from "zod";
import { sessionResp } from ".";

export type GoogleSleep = z.infer<typeof sessionResp>;

export const sessionSleepType = 72;
