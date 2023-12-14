export { IHEGateway, APIMode } from "./client/ihe-gateway";
export {
  PatientDiscoveryRequest,
  XCPDGateways,
  xcpdGatewaysSchema,
} from "./models/patient-discovery";
export { DocumentQueryRequest } from "./models/document-query";
export { DocumentRetrievalRequest } from "./models/document-retrieval";
export {
  documentReference,
  npiStringSchema,
  NPIStringArray,
  npiStringArraySchema,
  oidStringSchema,
  SamlAttributes,
  DocumentReference,
} from "./models/shared";
