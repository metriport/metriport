export { IHEGateway, APIMode } from "./client/ihe-gateway";
export {
  outboundPatientDiscoveryReqSchema,
  OutboundPatientDiscoveryReq,
  inboundPatientDiscoveryReqSchema,
  InboundPatientDiscoveryReq,
} from "./models/patient-discovery/patient-discovery-requests";
export {
  inboundPatientDiscoveryRespSchema,
  InboundPatientDiscoveryResp,
  outboundPatientDiscoveryRespSchema,
  OutboundPatientDiscoveryResp,
} from "./models/patient-discovery/patient-discovery-responses";
export {
  outboundDocumentQueryReqSchema,
  OutboundDocumentQueryReq,
  inboundDocumentQueryReqSchema,
  InboundDocumentQueryReq,
} from "./models/document-query/document-query-requests";
export {
  outboundDocumentQueryRespSchema,
  OutboundDocumentQueryResp,
  isOutboundDocumentQueryResponse,
  inboundDocumentQueryRespSchema,
  InboundDocumentQueryResp,
  InboundDocumentQueryRespSuccessful,
  InboundDocumentQueryRespFault,
} from "./models/document-query/document-query-responses";

export {
  outboundDocumentRetrievalReqSchema,
  OutboundDocumentRetrievalReq,
  inboundDocumentRetrievalReqSchema,
  InboundDocumentRetrievalReq,
} from "./models/document-retrieval/document-retrieval-requests";
export {
  outboundDocumentRetrievalRespSchema,
  OutboundDocumentRetrievalResp,
  isOutboundDocumentRetrievalResponse,
  inboundDocumentRetrievalRespSchema,
  InboundDocumentRetrievalResp,
  InboundDocumentRetrievalRespSuccessful,
  InboundDocumentRetrievalRespFault,
} from "./models/document-retrieval/document-retrieval-responses";

export {
  npiStringSchema,
  NPIString,
  NPIStringArray,
  npiStringArraySchema,
  oidStringSchema,
  BaseRequest,
  BaseErrorResponse,
  baseRequestSchema,
  DocumentReference,
  OperationOutcome,
  BaseResponse,
  XCAGateway,
  XCPDGateway,
  XCPDGateways,
  isBaseErrorResponse,
} from "./models/shared";
