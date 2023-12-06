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
  documentQueryRequestSchema,
  documentQueryResponseSchema,
} from "./models/document-query";
export {
  DocumentRetrievalRequest,
  documentRetrievalRequestSchema,
  DocumentRetrievalResponse,
  documentRetrievalResponseSchema,
} from "./models/document-retrieval";
export {
  documentReference,
  baseRequestSchema,
  baseResponseSchema,
  npiStringSchema,
  NPIStringArray,
  npiStringArraySchema,
  oidStringSchema,
  samlAttributes,
  SamlAttributes,
  DocumentReference,
  issue,
  operationOutcome,
  OperationOutcome,
} from "./models/shared";
