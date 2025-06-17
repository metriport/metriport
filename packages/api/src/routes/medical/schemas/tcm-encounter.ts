import { z } from "zod";
import { queryMetaSchema } from "../../pagination";
// import { TcmEncounterLatestEvent } from "../../../domain/medical/tcm-encounter";

export const tcmEncounterCreateSchema = z.object({
  cxId: z.string().uuid(),
  patientId: z.string().uuid(),
  facilityName: z.string(),
  latestEvent: z.enum(["Admitted", "Transferred", "Discharged"] as const),
  class: z.string(),
  admitTime: z.string().datetime().optional(),
  dischargeTime: z.string().datetime().nullable().optional(),
  clinicalInformation: z.record(z.unknown()),
});

export const tcmEncounterUpdateSchema = z.object({
  patientId: z.string().uuid().optional(),
  facilityName: z.string().optional(),
  latestEvent: z.enum(["Admitted", "Transferred", "Discharged"] as const).optional(),
  class: z.string().optional(),
  admitTime: z.string().datetime().optional(),
  dischargeTime: z.string().datetime().nullable().optional(),
  clinicalInformation: z.record(z.unknown()).optional(),
});

export const tcmEncounterResponseSchema = tcmEncounterCreateSchema.extend({
  id: z.string().uuid(),
  cxId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  eTag: z.string(),
});

export const tcmEncounterListQuerySchema = z
  .object({
    after: z.string().datetime().optional(),
  })
  .and(queryMetaSchema);

export type TcmEncounterCreate = z.infer<typeof tcmEncounterCreateSchema>;
export type TcmEncounterUpdate = z.infer<typeof tcmEncounterUpdateSchema>;
export type TcmEncounterResponse = z.infer<typeof tcmEncounterResponseSchema>;
export type TcmEncounterListQuery = z.infer<typeof tcmEncounterListQuerySchema>;
