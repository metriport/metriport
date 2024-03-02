export { IHEGateway } from "./client/ihe-gateway";
export {
  InboundDocumentQueryReq,
  inboundDocumentQueryReqSchema,
  OutboundDocumentQueryReq,
  outboundDocumentQueryReqSchema,
} from "./models/document-query/document-query-requests";
export {
  InboundDocumentQueryResp,
  InboundDocumentQueryRespFault,
  inboundDocumentQueryRespSchema,
  InboundDocumentQueryRespSuccessful,
  isSuccessfulOutboundDocQueryResponse,
  OutboundDocumentQueryResp,
  outboundDocumentQueryRespSchema,
} from "./models/document-query/document-query-responses";
export {
  InboundDocumentRetrievalReq,
  inboundDocumentRetrievalReqSchema,
  OutboundDocumentRetrievalReq,
  outboundDocumentRetrievalReqSchema,
} from "./models/document-retrieval/document-retrieval-requests";
export {
  InboundDocumentRetrievalResp,
  InboundDocumentRetrievalRespFault,
  inboundDocumentRetrievalRespSchema,
  InboundDocumentRetrievalRespSuccessful,
  isSuccessfulOutboundDocRetrievalResponse,
  OutboundDocumentRetrievalResp,
  outboundDocumentRetrievalRespSchema,
} from "./models/document-retrieval/document-retrieval-responses";
export {
  InboundPatientDiscoveryReq,
  inboundPatientDiscoveryReqSchema,
  OutboundPatientDiscoveryReq,
  outboundPatientDiscoveryReqSchema,
} from "./models/patient-discovery/patient-discovery-requests";
export {
  InboundPatientDiscoveryResp,
  inboundPatientDiscoveryRespSchema,
  OutboundPatientDiscoveryResp,
  outboundPatientDiscoveryRespSchema,
} from "./models/patient-discovery/patient-discovery-responses";
export {
  BaseErrorResponse,
  BaseRequest,
  baseRequestSchema,
  BaseResponse,
  DocumentReference,
  isBaseErrorResponse,
  NPIString,
  NPIStringArray,
  npiStringArraySchema,
  npiStringSchema,
  oidStringSchema,
  OperationOutcome,
  SamlAttributes,
  XCAGateway,
  XCPDGateway,
  XCPDGateways,
} from "./models/shared";
