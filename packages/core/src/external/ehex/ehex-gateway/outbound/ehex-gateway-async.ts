import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import chunk from "lodash/chunk";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";
import { defaultLambdaInvocationResponseHandler, makeLambdaClient } from "../../../aws/lambda";
import {
  DqRequestGatewayParams,
  DrRequestGatewayParams,
  EhexGateway,
  PdRequestGatewayParams,
} from "./ehex-gateway";

dayjs.extend(duration);

const SLEEP_IN_BETWEEN_DOCUMENT_RETRIEVAL_REQUESTS = dayjs.duration({ seconds: 1 });
const MAX_GATEWAYS_BEFORE_CHUNK = 500;
const MAX_DOCUMENT_QUERY_REQUESTS_PER_INVOCATION = 20;
const MAX_DOCUMENT_RETRIEVAL_REQUESTS_PER_INVOCATION = 10;

const ehexGatewayOutboundPatientDiscoveryLambdaName = "EhexGatewayOutboundPatientDiscoveryLambda";
const ehexGatewayOutboundDocumentQueryLambdaName = "EhexGatewayOutboundDocumentQueryLambda";
const ehexGatewayOutboundDocumentRetrievalLambdaName = "EhexGatewayOutboundDocumentRetrievalLambda";

function chunkRequests<T>(requests: T[], maxRequestsPerInvocation: number): T[][] {
  if (requests.length < 1) return [];
  const chunks = Math.ceil(requests.length / maxRequestsPerInvocation);
  const chunkSize = Math.ceil(requests.length / chunks);
  return chunk(requests, chunkSize);
}

export class EhexGatewayAsync extends EhexGateway {
  constructor() {
    super();
  }

  async startPatientDiscovery({
    pdRequest,
    patientId,
    cxId,
  }: {
    pdRequest: OutboundPatientDiscoveryReq;
    patientId: string;
    cxId: string;
  }): Promise<void> {
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const { gateways, ...rest } = pdRequest;

    const gatewayChunks = chunkRequests(gateways, MAX_GATEWAYS_BEFORE_CHUNK);

    for (const chunk of gatewayChunks) {
      const newPdRequestGateway = { ...rest, gateways: chunk };
      const params: PdRequestGatewayParams = {
        pdRequest: newPdRequestGateway,
        patientId,
        cxId,
      };

      // intentionally not waiting
      lambdaClient
        .invoke({
          FunctionName: ehexGatewayOutboundPatientDiscoveryLambdaName,
          InvocationType: "Event",
          Payload: JSON.stringify(params),
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: ehexGatewayOutboundPatientDiscoveryLambdaName,
          })
        )
        .catch(processAsyncError("Failed to invoke eHex lambda for patient discovery"));
    }
  }

  async startDocumentQueryGateway(params: DqRequestGatewayParams): Promise<void> {
    const { dqRequests: dqRequestsGateway, patientId, cxId, requestId } = params;
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const requestChunks = chunkRequests(
      dqRequestsGateway,
      MAX_DOCUMENT_QUERY_REQUESTS_PER_INVOCATION
    );

    for (const chunk of requestChunks) {
      const params: DqRequestGatewayParams = { patientId, cxId, requestId, dqRequests: chunk };

      // intentionally not waiting
      lambdaClient
        .invoke({
          FunctionName: ehexGatewayOutboundDocumentQueryLambdaName,
          InvocationType: "Event",
          Payload: JSON.stringify(params),
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: ehexGatewayOutboundDocumentQueryLambdaName,
          })
        )
        .catch(processAsyncError("Failed to invoke eHex lambda for document query"));
    }
  }

  async startDocumentRetrievalGateway(params: DrRequestGatewayParams): Promise<void> {
    const { drRequests, patientId, cxId, requestId } = params;
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const requestChunks = chunkRequests(drRequests, MAX_DOCUMENT_RETRIEVAL_REQUESTS_PER_INVOCATION);

    for (const [i, chunk] of requestChunks.entries()) {
      const payload: DrRequestGatewayParams = { patientId, cxId, requestId, drRequests: chunk };

      if (i > 0) {
        await sleep(SLEEP_IN_BETWEEN_DOCUMENT_RETRIEVAL_REQUESTS.asMilliseconds());
      }

      // intentionally not waiting
      lambdaClient
        .invoke({
          FunctionName: ehexGatewayOutboundDocumentRetrievalLambdaName,
          InvocationType: "Event",
          Payload: JSON.stringify(payload),
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: ehexGatewayOutboundDocumentRetrievalLambdaName,
          })
        )
        .catch(processAsyncError("Failed to invoke eHex lambda for document retrieval"));
    }
  }
}
