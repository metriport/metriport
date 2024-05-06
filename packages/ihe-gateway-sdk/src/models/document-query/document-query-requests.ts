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
export const outboundDocumentQueryReqSchema = documentQueryDefaultReqSchema.extend({
  gateway: xcaGatewaySchema,
  patientId: z.string(),
  cxId: z.string(),
});

export type OutboundDocumentQueryReq = z.infer<typeof outboundDocumentQueryReqSchema>;

// FROM EXTERNAL GATEWAY
export const inboundDocumentQueryReqSchema = documentQueryDefaultReqSchema;

export type InboundDocumentQueryReq = z.infer<typeof inboundDocumentQueryReqSchema>;
