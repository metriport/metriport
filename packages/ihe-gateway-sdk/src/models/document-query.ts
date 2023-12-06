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

export const documentQueryRequestSchema = z.array(
  baseRequestSchema.extend({
    xcaHomeCommunityId: z.string(),
    xcpdPatientId: z.object({ id: z.string(), system: z.string() }),
    patientId: z.string().nullable(),
    xcaGateway: z.string(),
    classCode: z.array(code).nullable(),
    practiceSettingCode: z.array(code).nullable(),
    facilityTypeCode: z.array(code).nullable(),
    documentCreationDate: dateRange.nullable(),
    serviceDate: dateRange.nullable(),
  })
);

export type DocumentQueryRequest = z.infer<typeof documentQueryRequestSchema>;

export const documentQueryResponseSchema = baseResponseSchema.extend({
  documentReference: z.array(documentReference).nullable(),
  xcaHomeCommunityId: z.string(),
});

export type DocumentQueryResponse = z.infer<typeof documentQueryResponseSchema>;
