import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import chunk from "lodash/chunk";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";
import { defaultLambdaInvocationResponseHandler, makeLambdaClient } from "../../../aws/lambda";
import { IHEGatewayV2, DQRequestGatewayV2Params, DRRequestGatewayV2Params } from "./ihe-gateway-v2";

dayjs.extend(duration);

const SLEEP_IN_BETWEEN_DOCUMENT_RETRIEVAL_REQUESTS = dayjs.duration({ seconds: 1 });
const MAX_GATEWAYS_BEFORE_CHUNK = 500;
const MAX_DOCUMENT_QUERY_REQUESTS_PER_INVOCATION = 20;
const MAX_DOCUMENT_RETRIEVAL_REQUESTS_PER_INVOCATION = 10;

const iheGatewayV2OutboundPatientDiscoveryLambdaName = "IHEGatewayV2OutboundPatientDiscoveryLambda";
const iheGatewayV2OutboundDocumentQueryLambdaName = "IHEGatewayV2OutboundDocumentQueryLambda";
const iheGatewayV2OutboundDocumentRetrievalLambdaName =
  "IHEGatewayV2OutboundDocumentRetrievalLambda";

function chunkRequests<T>(requests: T[], maxRequestsPerInvocation: number): T[][] {
  const chunks = Math.ceil(requests.length / maxRequestsPerInvocation);
  const chunkSize = Math.ceil(requests.length / chunks);
  return chunk(requests, chunkSize);
}

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
    const { gateways, ...rest } = pdRequestGatewayV2;

    const gatewayChunks = chunkRequests(gateways, MAX_GATEWAYS_BEFORE_CHUNK);

    for (const chunk of gatewayChunks) {
      const newPdRequestGatewayV2 = { ...rest, gateways: chunk };
      const params = { pdRequestGatewayV2: newPdRequestGatewayV2, patientId, cxId };

      // intentionally not waiting
      lambdaClient
        .invoke({
          FunctionName: iheGatewayV2OutboundPatientDiscoveryLambdaName,
          InvocationType: "Event",
          Payload: JSON.stringify(params),
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: iheGatewayV2OutboundPatientDiscoveryLambdaName,
          })
        )
        .catch(processAsyncError("Failed to invoke iheGatewayV2 lambda for patient discovery"));
    }
  }

  async startDocumentQueryGatewayV2(params: DQRequestGatewayV2Params): Promise<void> {
    const { dqRequestsGatewayV2, patientId, cxId, requestId } = params;
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const requestChunks = chunkRequests(
      dqRequestsGatewayV2,
      MAX_DOCUMENT_QUERY_REQUESTS_PER_INVOCATION
    );

    for (const chunk of requestChunks) {
      const params = { patientId, cxId, requestId, dqRequestsGatewayV2: chunk };

      // intentionally not waiting
      lambdaClient
        .invoke({
          FunctionName: iheGatewayV2OutboundDocumentQueryLambdaName,
          InvocationType: "Event",
          Payload: JSON.stringify(params),
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: iheGatewayV2OutboundDocumentQueryLambdaName,
          })
        )
        .catch(processAsyncError("Failed to invoke iheGWV2 lambda for document query"));
    }
  }

  async startDocumentRetrievalGatewayV2(params: DRRequestGatewayV2Params): Promise<void> {
    const { drRequestsGatewayV2, patientId, cxId, requestId } = params;
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const requestChunks = chunkRequests(
      drRequestsGatewayV2,
      MAX_DOCUMENT_RETRIEVAL_REQUESTS_PER_INVOCATION
    );

    for (const [i, chunk] of requestChunks.entries()) {
      const params = { patientId, cxId, requestId, drRequestsGatewayV2: chunk };

      if (i > 0) {
        await sleep(SLEEP_IN_BETWEEN_DOCUMENT_RETRIEVAL_REQUESTS.asMilliseconds());
      }

      // intentionally not waiting
      lambdaClient
        .invoke({
          FunctionName: iheGatewayV2OutboundDocumentRetrievalLambdaName,
          InvocationType: "Event",
          Payload: JSON.stringify(params),
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: iheGatewayV2OutboundDocumentRetrievalLambdaName,
          })
        )
        .catch(processAsyncError("Failed to invoke iheGWV2 lambda for document retrieval"));
    }
  }
}
