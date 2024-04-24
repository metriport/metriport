import {
  OutboundPatientDiscoveryReq,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../aws/lambda";
import { Config } from "../../../util/config";
import { processAsyncError } from "../../../util/error/shared";
import { IHEGatewayV2 } from "./ihe-gateway-v2";

const iheGatewayV2OutboundPatientDiscoveryLambdaName = "IHEGatewayV2OutboundPatientDiscoveryLambda";
const iheGatewayV2OutboundDocumentQueryLambdaName = "IHEGatewayV2OutboundDocumentQueryLambda";
const iheGatewayV2OutboundDocumentRetrievalLambdaName =
  "IHEGatewayV2OutboundDocumentRetrievalLambda";

export class IHEGatewayV2Async extends IHEGatewayV2 {
  constructor() {
    super();
  }

  async startPatientDiscovery({
    pdRequestGatewayV2,
    patientId,
    cxId,
  }: {
    pdRequestGatewayV2: OutboundPatientDiscoveryReq;
    patientId: string;
    cxId: string;
  }): Promise<void> {
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const params = { patientId, cxId, pdRequestGatewayV2 };
    // intentionally not waiting
    lambdaClient
      .invoke({
        FunctionName: iheGatewayV2OutboundPatientDiscoveryLambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .catch(
        processAsyncError("Failed to invoke lambda to poll outbound patient discovery responses")
      );
  }

  async startDocumentQueryGatewayV2({
    dqRequestsGatewayV2,
    patientId,
    cxId,
    requestId,
  }: {
    dqRequestsGatewayV2: OutboundDocumentQueryReq[];
    patientId: string;
    cxId: string;
    requestId: string;
  }): Promise<void> {
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const params = { patientId, cxId, requestId, dqRequestsGatewayV2 };
    // intentionally not waiting
    lambdaClient
      .invoke({
        FunctionName: iheGatewayV2OutboundDocumentQueryLambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .catch(processAsyncError("Failed to invoke iheGWV2 lambda for document retrieval"));
  }
  async startDocumentRetrievalGatewayV2({
    drRequestsGatewayV2,
    patientId,
    cxId,
    requestId,
  }: {
    drRequestsGatewayV2: OutboundDocumentRetrievalReq[];
    patientId: string;
    cxId: string;
    requestId: string;
  }): Promise<void> {
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const params = { patientId, cxId, requestId, drRequestsGatewayV2 };

    lambdaClient
      .invoke({
        FunctionName: iheGatewayV2OutboundDocumentRetrievalLambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .catch(processAsyncError("Failed to invoke iheGWV2 lambda for document retrieval"));
  }
}
