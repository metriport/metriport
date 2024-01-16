export { IHEGateway, APIMode } from "./client/ihe-gateway";
export {
  patientDiscoveryReqToExternalGWSchema,
  patientDiscoveryReqFromExternalGatewaySchema,
  PatientDiscoveryReqFromExternalGW,
  PatientDiscoveryReqToExternalGW,
} from "./models/patient-discovery/patient-discovery-requests";
export {
  patientDiscoveryRespToExternalGWSchema,
  patientDiscoveryRespFromExternalGWSchema,
  PatientDiscoveryRespFromExternalGW,
  PatientDiscoveryRespToExternalGW,
} from "./models/patient-discovery/patient-discovery-responses";

export {
  documentQueryReqToExternalGWSchema,
  documentQueryReqFromExternalGWSchema,
  DocumentQueryReqFromExternalGW,
  DocumentQueryReqToExternalGW,
} from "./models/document-query/document-query-requests";
export {
  documentQueryRespToExternalGWSchema,
  documentQueryRespFromExternalGWSchema,
  DocumentQueryRespFromExternalGW,
  DocumentQueryRespToExternalGW,
  isDocumentQueryResponse,
} from "./models/document-query/document-query-responses";

export {
  documentRetrievalReqToExternalGWSchema,
  documentRetrievalReqFromExternalGWSchema,
  DocumentRetrievalReqFromExternalGW,
  DocumentRetrievalReqToExternalGW,
} from "./models/document-retrieval/document-retrieval-requests";
export {
  documentRetrievalRespToExternalGWSchema,
  documentRetrievalRespFromExternalGWSchema,
  DocumentRetrievalRespFromExternalGW,
  DocumentRetrievalRespToExternalGW,
  isDocumentRetrievalResponse,
} from "./models/document-retrieval/document-retrieval-responses";

export {
  npiStringSchema,
  NPIString,
  NPIStringArray,
  npiStringArraySchema,
  oidStringSchema,
  BaseRequest,
  baseRequestSchema,
  DocumentReference,
  OperationOutcome,
  BaseResponse,
  XCAGateway,
  XCPDGateway,
  isBaseErrorResponse,
} from "./models/shared";
