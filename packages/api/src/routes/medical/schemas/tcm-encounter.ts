import { z } from "zod";
import { queryMetaSchema } from "../../pagination";
import { buildDayjs } from "@metriport/shared/common/date";

export const tcmEncounterBaseSchema = z.strictObject({
  patientId: z.string().uuid(),
  facilityName: z.string(),
  latestEvent: z.enum(["Admitted", "Transferred", "Discharged"] as const),
  class: z.string(),
  admitTime: z
    .string()
    .datetime()
    .transform(val => buildDayjs(val).toDate())
    .optional(),
  dischargeTime: z
    .string()
    .datetime()
    .transform(val => buildDayjs(val).toDate())
    .nullish(),
  clinicalInformation: z.record(z.unknown()).optional().default({}),
});

export const tcmEncounterCreateSchema = tcmEncounterBaseSchema.extend({
  id: z.string().uuid().optional(),
  cxId: z.string().uuid(),
});
export type TcmEncounterCreate = z.infer<typeof tcmEncounterCreateSchema>;
export type TcmEncounterCreateInput = z.input<typeof tcmEncounterCreateSchema>;

export const tcmEncounterUpdateSchema = tcmEncounterBaseSchema.partial();

export const tcmEncounterResponseSchema = tcmEncounterCreateSchema.extend({
  id: z.string().uuid(),
  patientName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  eTag: z.string(),
});
export type TcmEncounterResponse = z.infer<typeof tcmEncounterResponseSchema>;

const tcmEncounterQuerySchema = z
  .object({
    after: z.string().datetime().optional(),
  })
  .and(queryMetaSchema);

export const tcmEncounterListQuerySchema = tcmEncounterQuerySchema;
export type TcmEncounterListQuery = z.infer<typeof tcmEncounterListQuerySchema>;
