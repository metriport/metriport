import {
  BaseRequest,
  BaseResponse,
  BaseErrorResponse,
  DocumentReference,
  XCAGateway,
  XCPDPatientId,
  Code,
} from "./shared";

export type DateRange = {
  dateFrom: string;
  dateTo: string;
};

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

export type DocumentQueryResponseIncoming =
  | (BaseResponse & {
      documentReference: DocumentReference[];
      gateway: { homeCommunityId: string; url: string };
    })
  | BaseErrorResponse;

export type DocumentQueryRequestIncoming = BaseRequest & {
  xcpdPatientId: XCPDPatientId;
  classCode?: Code[];
  practiceSettingCode?: Code[];
  facilityTypeCode?: Code[];
  documentCreationDate?: DateRange;
  serviceDate?: DateRange;
};

export type DocumentQueryResponseOutgoing =
  | (BaseResponse & {
      documentReference: DocumentReference[];
    })
  | BaseErrorResponse;

export function isDocumentQueryResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any
): obj is DocumentQueryResponseIncoming & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}
