import * as z from "zod";
import { ON_DEMAND_DOCUMENT_TYPE_UUID, STABLE_DOCUMENT_TYPE_UUID } from "../..";
import {
  baseRequestSchema,
  codeSchema,
  externalGatewayPatientSchema,
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
  documentType: z.string().optional(),
});

export type OutboundDocumentQueryReq = z.infer<typeof outboundDocumentQueryReqSchema>;

// FROM EXTERNAL GATEWAY
export const inboundDocumentQueryReqSchema = documentQueryDefaultReqSchema;
export type InboundDocumentQueryReq = z.infer<typeof inboundDocumentQueryReqSchema>;

const documentTypeSchema = z.enum([STABLE_DOCUMENT_TYPE_UUID, ON_DEMAND_DOCUMENT_TYPE_UUID]);
export type RequestedDocumentType = z.infer<typeof documentTypeSchema>;

const requestedDocumentTypeSchema = z.array(documentTypeSchema);

export const inboundSpecificDocumentQueryReqSchema = inboundDocumentQueryReqSchema.extend({
  documentType: requestedDocumentTypeSchema,
});
export type InboundSpecificDocumentQueryReq = z.infer<typeof inboundSpecificDocumentQueryReqSchema>;
