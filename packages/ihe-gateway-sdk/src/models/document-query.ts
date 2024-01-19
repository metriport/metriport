import {
  BaseRequest,
  BaseResponse,
  BaseErrorResponse,
  DocumentReference,
  XCAGateway,
  XCPDPatientId,
  xcpdPatientIdSchema,
  baseRequestSchema,
  codeSchema,
  Code,
  baseResponseSchema,
  baseErrorResponseSchema,
  xcaGatewaySchema,
  documentReferenceSchema,
} from "./shared";
import * as z from "zod";

export const dateRangeSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
});
export type DateRange = z.infer<typeof dateRangeSchema>;

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

export const documentQueryResponseIncomingSchema = z.union([
  z.intersection(
    baseResponseSchema,
    z.object({
      documentReference: documentReferenceSchema.array(),
      gateway: xcaGatewaySchema,
    })
  ),
  baseErrorResponseSchema,
]);
export type DocumentQueryResponseIncoming = z.infer<typeof documentQueryResponseIncomingSchema>;

export const documentQueryRequestIncomingSchema = z.intersection(
  baseRequestSchema,
  z.object({
    xcpdPatientId: xcpdPatientIdSchema,
    classCode: z.array(codeSchema).optional(),
    practiceSettingCode: z.array(codeSchema).optional(),
    facilityTypeCode: z.array(codeSchema).optional(),
    documentCreationDate: dateRangeSchema.optional(),
    serviceDate: dateRangeSchema.optional(),
  })
);

export type DocumentQueryRequestIncoming = z.infer<typeof documentQueryRequestIncomingSchema>;

export type DocumentQueryResponseOutgoing =
  | (BaseResponse & {
      documentReference: DocumentReference[];
      operationOutcome?: never;
    })
  | (BaseErrorResponse & {
      documentReference?: never;
    });

export function isDocumentQueryResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: BaseResponse
): obj is DocumentQueryResponseIncoming & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}
