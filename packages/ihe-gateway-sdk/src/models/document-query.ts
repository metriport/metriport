import {
  BaseRequest,
  baseRequestSchema,
  baseResponseSchema,
  BaseResponse,
  documentReferenceSchema,
  DocumentReference,
  XCAGateway,
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

export const xcpdPatientIdSchema = z.object({
  id: z.string(),
  system: z.string(),
});

export type XCPDPatientId = z.infer<typeof xcpdPatientIdSchema>;
export type Code = z.infer<typeof codeSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;

// The following are for us creating a document query request

export type DocumentQueryRequestOutgoing = BaseRequest & {
  cxId: string;
  xcpdPatientId: XCPDPatientId;
  patientId?: string;
  xcaGateway: XCAGateway;
  classCode?: Code[];
  practiceSettingCode?: Code[];
  facilityTypeCode?: Code[];
  documentCreationDate?: DateRange;
  serviceDate?: DateRange;
};

export const documentQueryResponseIncomingSchema = baseResponseSchema.extend({
  cxId: z.string(),
  documentReference: z.array(documentReferenceSchema).nullable(),
  xcaHomeCommunityId: z.string(),
});
export type DocumentQueryResponse = z.infer<typeof documentQueryResponseIncomingSchema>;

// The following are for us responding to a document query request

export const DocumentQueryRequestIncomingSchema = baseRequestSchema.extend({
  xcpdPatientId: z.object({ id: z.string(), system: z.string() }),
  classCode: z.array(codeSchema).optional(),
  practiceSettingCode: z.array(codeSchema).optional(),
  facilityTypeCode: z.array(codeSchema).optional(),
  documentCreationDate: z.array(dateRangeSchema).optional(),
  serviceDate: z.array(dateRangeSchema).optional(),
});

export type DocumentQueryRequestIncoming = z.infer<typeof DocumentQueryRequestIncomingSchema>;

// TODO the definition here doesnt havea xcpdPatientId on notion. Currently nullable in baseResponse
export type DocumentQueryResponseOutgoing = BaseResponse & {
  documentReference: DocumentReference[];
};
