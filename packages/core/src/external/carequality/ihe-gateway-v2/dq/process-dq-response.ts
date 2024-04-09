import { OutboundDocumentQueryReq, OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";

export type GirthDQRequestParams = {
  patientId: string;
  cxId: string;
  dqRequestsGirth: OutboundDocumentQueryReq[];
};

type DQGateway = {
  homeCommunityId: string;
  url: string;
};

export function processDQResponse({
  xmlStringOrError,
  outboundRequest,
  gateway,
}: {
  xmlStringOrError: string | { error: string };
  outboundRequest: OutboundDocumentQueryReq;
  gateway: DQGateway;
}): OutboundDocumentQueryResp {
  console.log("xmlStringOrError", xmlStringOrError);
  console.log("outboundRequest", outboundRequest);
  console.log("gateway", gateway);
  throw new Error("Not implemented");
}
