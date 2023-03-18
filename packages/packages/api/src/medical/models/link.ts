import { z } from "zod";
import { demographicsSchema } from "./demographics";

export enum MedicalDataSource {
  COMMONWELL = "COMMONWELL",
}

export const linkSchema = z.object({
  entityId: z.string(),
  potential: z.boolean(),
  source: z.nativeEnum(MedicalDataSource),
  patient: z.object({ id: z.string() }).merge(demographicsSchema),
});
export type Link = z.infer<typeof linkSchema>;

export const patientLinksSchema = z.object({
  potentialLinks: linkSchema.array(),
  currentLinks: linkSchema.array(),
});
export type PatientLinks = z.infer<typeof patientLinksSchema>;

export const linkStatusSchema = z.literal("linked").or(z.literal("needs-review"));
export type LinkStatus = z.infer<typeof linkStatusSchema>;

export const linkStatusAcrossHIEsSchema = z.record(
  z.nativeEnum(MedicalDataSource),
  linkStatusSchema
);
export type LinkStatusAcrossHIEs = z.infer<typeof linkStatusAcrossHIEsSchema>;
