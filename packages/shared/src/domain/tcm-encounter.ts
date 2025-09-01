import { buildDayjs } from "../common/date";
import { createQueryMetaSchema } from "./pagination";
import { z } from "zod";

export const tcmEncounterMaxPageSize = 10000;
const stringOrNullSchema = z.union([z.string(), z.undefined(), z.null()]);

export const outreachStatuses = ["Not Started", "Attempted", "Completed"] as const;

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
  outreachStatus: z.enum(outreachStatuses).default("Not Started"),
  lastOutreachDate: z
    .string()
    .datetime()
    .transform(val => buildDayjs(val).toDate())
    .nullish()
    .transform(val => (val === null ? undefined : val)),
  clinicalInformation: z.record(z.unknown()).optional().default({}),
  freetextNote: z.string().optional(),
  dischargeSummaryPath: z.string().optional(),
});

export const tcmEncounterCreateSchema = tcmEncounterBaseSchema.extend({
  cxId: z.string().uuid(),
  id: z.string().uuid().optional(),
  outreachStatus: z.enum(outreachStatuses).optional(),
});
export type TcmEncounterCreate = z.infer<typeof tcmEncounterCreateSchema>;

export const tcmEncounterUpsertSchema = tcmEncounterBaseSchema.extend({
  id: z.string().uuid(),
  cxId: z.string().uuid(),
  outreachStatus: z.enum(outreachStatuses).optional(),
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
    facilityId: z.string().uuid().optional(),
    daysLookback: z.enum(["2", "7"]).optional().default("7"),
    eventType: z.enum(["Admitted", "Discharged"] as const).optional(),
    coding: z.enum(["cardiac"]).optional(),
    status: z.enum(outreachStatuses).optional(),
    search: z.string().optional(),
    encounterClass: z
      .enum(["inpatient encounter", "ambulatory", "emergency", "short stay", "pre-admission"])
      .optional(),
  })
  .and(createQueryMetaSchema(tcmEncounterMaxPageSize));

export const tcmEncounterListQuerySchema = tcmEncounterQuerySchema;
export type TcmEncounterListQuery = z.infer<typeof tcmEncounterListQuerySchema>;

export type TcmEncounterUpsertInput = z.input<typeof tcmEncounterUpsertSchema>;

export const ROSTER_UPLOAD_SFTP_PASSWORD = "ROSTER_UPLOAD_SFTP_PASSWORD";
