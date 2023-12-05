import { baseResponseSchema, documentReference, baseRequestSchema } from "./shared";
import { z } from "zod";

export const code = z.object({
  system: z.string(),
  code: z.string(),
});

export const dateRange = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const xcaIti38RequestSchema = z.array(
  baseRequestSchema.extend({
    homeCommunityId: z.string(),
    xcpdPatientId: z.object({ id: z.string(), system: z.string() }),
    patientResourceId: z.string().nullable(),
    xcaGateway: z.string(),
    classCode: z.array(code).nullable(),
    practiceSettingCode: z.array(code).nullable(),
    facilityTypeCode: z.array(code).nullable(),
    documentCreationDate: dateRange.nullable(),
    serviceDate: dateRange.nullable(),
  })
);

export type XCA_ITI_38Request = z.infer<typeof xcaIti38RequestSchema>;

export const xcaIti38ResponseSchema = baseResponseSchema.extend({
  documentReference: z.array(documentReference).nullable(),
});

export type XCA_ITI_38Response = z.infer<typeof xcaIti38ResponseSchema>;
