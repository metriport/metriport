import { z } from "zod";
import { dexcomResp, baseRecordSchema } from ".";

// https://developer.dexcom.com/docs/dexcomv3/operation/getEventsV3/
export const eventRecordSchema = z
  .object({
    eventStatus: z.string(),
    eventType: z.string(),
    eventSubType: z.string().nullable().optional(),
    value: z.string(),
    unit: z.string().nullable().optional(),
    transmitterId: z.string(),
  })
  .merge(baseRecordSchema);

export type EventRecord = z.infer<typeof eventRecordSchema>;

export const dexcomEventsResp = dexcomResp.merge(
  z.object({
    records: z.array(eventRecordSchema),
  })
);

export type DexcomEvents = z.infer<typeof dexcomEventsResp>;
