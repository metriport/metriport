import {
  BaseRequest,
  baseRequestSchema,
  baseResponseSchema,
  BaseResponse,
  documentReferenceSchema,
  DocumentReference,
  XCAGatewaySchema,
  XCAGateway,
  XCPDPatientId,
  xcpdPatientIdSchema,
} from "./shared";
import { z } from "zod";

export const codeSchema = z.object({
  system: z.string(),
  code: z.string(),
});

export const dateRangeSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
});

export type Code = z.infer<typeof codeSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;

// The following are for us creating a document query request

export type DocumentQueryRequestOutgoing = BaseRequest & {
  cxId: string;
  xcpdPatientId: XCPDPatientId;
  patientId?: string;
  gateway: XCAGateway;
  classCode?: Code[];
  practiceSettingCode?: Code[];
  facilityTypeCode?: Code[];
  documentCreationDate?: DateRange;
  serviceDate?: DateRange;
};

export const documentQueryResponseIncomingSchema = baseResponseSchema.extend({
  cxId: z.string(),
  gateway: XCAGatewaySchema.nullish(),
  documentReference: z.array(documentReferenceSchema).nullish(),
});
export type DocumentQueryResponse = z.infer<typeof documentQueryResponseIncomingSchema>;

// The following are for us responding to a document query request

export const DocumentQueryRequestIncomingSchema = baseRequestSchema.extend({
  xcpdPatientId: xcpdPatientIdSchema,
  classCode: z.array(codeSchema).nullish(),
  practiceSettingCode: z.array(codeSchema).nullish(),
  facilityTypeCode: z.array(codeSchema).nullish(),
  documentCreationDate: z.array(dateRangeSchema).nullish(),
  serviceDate: z.array(dateRangeSchema).nullish(),
});

export type DocumentQueryRequestIncoming = z.infer<typeof DocumentQueryRequestIncomingSchema>;

// TODO the definition here doesnt havea xcpdPatientId on notion. Currently nullish in baseResponse
export type DocumentQueryResponseOutgoing = BaseResponse & {
  documentReference: DocumentReference[];
};
