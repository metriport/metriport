import {
  BaseRequest,
  BaseResponse,
  DocumentReference,
  XCAGateway,
  XCPDPatientId,
  Code,
} from "./shared";

export type DateRange = {
  dateFrom: string;
  dateTo: string;
};

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

// The following are for us responding to a document query request
export type DocumentQueryRequestIncoming = BaseRequest & {
  xcpdPatientId: XCPDPatientId;
  classCode?: Code[];
  practiceSettingCode?: Code[];
  facilityTypeCode?: Code[];
  documentCreationDate?: DateRange;
  serviceDate?: DateRange;
};
// DocumentReference optional because the error response doesnt have it
export type DocumentQueryResponseOutgoing = BaseResponse & {
  documentReference?: DocumentReference[];
};
