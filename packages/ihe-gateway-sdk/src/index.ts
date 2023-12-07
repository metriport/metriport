export { IHEGateway, APIMode } from "./client/ihe-gateway";
export {
  PatientDiscoveryRequest,
  XCPDGateways,
  PatientDiscoveryResponse,
  xcpdGatewaysSchema,
  patientDiscoveryResponseSchema,
} from "./models/patient-discovery";
export {
  DocumentQueryRequest,
  DocumentQueryResponse,
  documentQueryResponseSchema,
} from "./models/document-query";
export {
  DocumentRetrievalRequest,
  DocumentRetrievalResponse,
  documentRetrievalResponseSchema,
} from "./models/document-retrieval";
export {
  documentReference,
  baseResponseSchema,
  npiStringSchema,
  NPIStringArray,
  npiStringArraySchema,
  oidStringSchema,
  SamlAttributes,
  DocumentReference,
  issue,
  operationOutcome,
} from "./models/shared";
