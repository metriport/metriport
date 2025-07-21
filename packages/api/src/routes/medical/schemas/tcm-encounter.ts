import { z } from "zod";
import { queryMetaSchema } from "../../pagination";
import { buildDayjs } from "@metriport/shared/common/date";

const stringOrNullSchema = z.union([z.string(), z.undefined(), z.null()]);

export const tcmEncounterBaseSchema = z.strictObject({
  patientId: z.string().uuid(),
  facilityName: stringOrNullSchema.transform(val => val ?? ""),
  latestEvent: z.enum(["Admitted", "Transferred", "Discharged"] as const),
  class: stringOrNullSchema.transform(val => val ?? ""),
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
  freetextNote: z.string().optional(),
  dischargeSummaryPath: z.string().optional(),
});

export const tcmEncounterCreateSchema = tcmEncounterBaseSchema.extend({
  cxId: z.string().uuid(),
  id: z.string().uuid().optional(),
});
export type TcmEncounterCreate = z.infer<typeof tcmEncounterCreateSchema>;

export const tcmEncounterUpsertSchema = tcmEncounterBaseSchema.extend({
  id: z.string().uuid(),
  cxId: z.string().uuid(),
});
export type TcmEncounterUpsert = z.infer<typeof tcmEncounterUpsertSchema>;

export const tcmEncounterUpdateSchema = tcmEncounterBaseSchema.partial();

export const tcmEncounterResponseSchema = tcmEncounterUpsertSchema.extend({
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
