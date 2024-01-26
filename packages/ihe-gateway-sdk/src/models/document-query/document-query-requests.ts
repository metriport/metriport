import * as z from "zod";
import {
  externalGatewayPatientSchema,
  baseRequestSchema,
  codeSchema,
  xcaGatewaySchema,
} from "../shared";

export const dateRangeSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;

const documentQueryDefaultReqSchema = baseRequestSchema.extend({
  externalGatewayPatient: externalGatewayPatientSchema,
  classCode: codeSchema.optional(),
  practiceSettingCode: codeSchema.optional(),
  facilityTypeCode: codeSchema.optional(),
  documentCreationDate: dateRangeSchema.optional(),
  serviceDate: dateRangeSchema.optional(),
});

// TO EXTERNAL GATEWAY
export const documentQueryReqToExternalGWSchema = documentQueryDefaultReqSchema.extend({
  gateway: xcaGatewaySchema,
});

export type DocumentQueryReqToExternalGW = z.infer<typeof documentQueryReqToExternalGWSchema>;

// FROM EXTERNAL GATEWAY
export const documentQueryReqFromExternalGWSchema = documentQueryDefaultReqSchema;

export type DocumentQueryReqFromExternalGW = z.infer<typeof documentQueryReqFromExternalGWSchema>;
