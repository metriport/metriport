export { IHEGateway, APIMode } from "./client/ihe-gateway";
export {
  PatientDiscoveryRequestOutgoing,
  PatientDiscoveryResponseIncoming,
  PatientDiscoveryResponseOutgoing,
  PatientDiscoveryRequestIncoming,
  XCPDGateways,
} from "./models/patient-discovery";
export {
  DocumentQueryRequestOutgoing,
  DocumentQueryResponseIncoming,
  DocumentQueryResponseOutgoing,
  DocumentQueryRequestIncoming,
  isDocumentQueryResponse,
} from "./models/document-query";
export {
  DocumentRetrievalRequestOutgoing,
  DocumentRetrievalResponseIncoming,
  DocumentRetrievalResponseOutgoing,
  DocumentRetrievalRequestIncoming,
  isDocumentRetrievalResponse,
} from "./models/document-retrieval";
export {
  npiStringSchema,
  NPIString,
  NPIStringArray,
  npiStringArraySchema,
  oidStringSchema,
  SamlAttributes,
  BaseRequest,
  DocumentReference,
  OperationOutcome,
  BaseResponse,
  XCAGateway,
  isBaseErrorResponse,
} from "./models/shared";
