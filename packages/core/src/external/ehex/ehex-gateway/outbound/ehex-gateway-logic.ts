import {
  isSuccessfulOutboundDocQueryResponse,
  isSuccessfulOutboundDocRetrievalResponse,
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  OutboundPatientDiscoveryReq,
  XCPDGateway,
} from "@metriport/ihe-gateway-sdk";
import {
  defaultOptionsRequestNotAccepted,
  errorToString,
  executeWithNetworkRetries,
  executeWithRetries,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import httpStatus from "http-status";
import { buildS3WriterHandler } from "../../../../command/write-to-storage/s3/write-to-s3-factory";
import { createHivePartitionFilePath } from "../../../../domain/filename";
import { Config } from "../../../../util/config";
import { log as getLog, out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { SamlCertsAndKeys } from "../saml/security/types";
import {
  storeAuditLogForDq,
  storeAuditLogForDr,
  storeAuditLogForXcpd,
} from "./ehex-gateway-outbound-auditing";
import { createAndSignBulkDQRequests, SignedDqRequest } from "./xca/create/iti38-envelope";
import { createAndSignBulkDRRequests, SignedDrRequest } from "./xca/create/iti39-envelope";
import { processDqResponse } from "./xca/process/dq-response";
import { processDrResponse } from "./xca/process/dr-response";
import { isRetryable as isRetryableXca } from "./xca/process/error";
import { sendSignedDqRequest } from "./xca/send/dq-requests";
import { sendSignedDrRequest } from "./xca/send/dr-requests";
import { createAndSignBulkXcpdRequests, SignedXcpdRequest } from "./xcpd/create/iti55-envelope";
import { EhexOutboundPatientDiscoveryResp } from "./xcpd/process/types";
import { handleSchemaErrorResponse, isRetryable as isRetryableXcpd } from "./xcpd/process/error";
import { processXCPDResponse } from "./xcpd/process/xcpd-response";
import { sendSignedXcpdRequest } from "./xcpd/send/xcpd-requests";

dayjs.extend(duration);

const parsedResponsesBucket = Config.getEhexParsedResponsesBucketName();

export async function sendProcessXcpdRequest({
  signedRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  signedRequest: SignedXcpdRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<EhexOutboundPatientDiscoveryResp> {
  async function sendAndProcess() {
    const { response, responseHttpStatusCode } = await sendSignedXcpdRequest({
      request: signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });

    return processXCPDResponse({
      xcpdResponse: response,
      patientId,
      cxId,
      responseHttpStatusCode,
    });
  }

  return await executeWithRetries<EhexOutboundPatientDiscoveryResp>(sendAndProcess, {
    initialDelay: 3000,
    maxAttempts: 3,
    shouldRetry: isRetryableXcpd,
    log: out(`sendProcessRetryXcpdRequest, oid: ${signedRequest.gateway.oid}`).log,
  });
}

export async function sendProcessRetryDqRequest({
  signedRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  signedRequest: SignedDqRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<OutboundDocumentQueryResp> {
  async function sendProcessDqRequest() {
    const response = await sendSignedDqRequest({
      request: signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    return processDqResponse({
      response,
    });
  }

  return await executeWithRetries(sendProcessDqRequest, {
    initialDelay: 3000,
    maxAttempts: 3,
    shouldRetry: isRetryableXca,
    log: out(`sendProcessRetryDqRequest, oid: ${signedRequest.gateway.homeCommunityId}`).log,
  });
}

export async function sendProcessRetryDrRequest({
  signedRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
  index,
}: {
  signedRequest: SignedDrRequest;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  index: number;
}): Promise<OutboundDocumentRetrievalResp> {
  async function sendProcessDrRequest() {
    const response = await sendSignedDrRequest({
      request: signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    return await processDrResponse({
      response,
    });
  }
  return await executeWithRetries(sendProcessDrRequest, {
    initialDelay: 3000,
    maxAttempts: 3,
    shouldRetry: isRetryableXca,
    log: out(
      `sendProcessRetryDrRequest, oid: ${signedRequest.outboundRequest.gateway.homeCommunityId}, requestChunkId: ${signedRequest.outboundRequest.requestChunkId}`
    ).log,
  });
}

export async function createSignSendProcessXcpdRequests({
  appInstanceId,
  pdResponseUrl,
  xcpdRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  appInstanceId: string;
  pdResponseUrl: string;
  xcpdRequest: OutboundPatientDiscoveryReq;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkXcpdRequests(xcpdRequest, samlCertsAndKeys);
  const resultS3PayloadsWithFilePaths: [string, string][] = [];

  const resultPromises = signedRequests.map(async (signingResult, index) => {
    if (signingResult.success) {
      const result = await createSignSendProcessSingleXcpdRequest({
        signedRequest: signingResult.signedRequest,
        index,
        appInstanceId,
        pdResponseUrl,
        samlCertsAndKeys,
        patientId,
        cxId,
      });
      if (result) resultS3PayloadsWithFilePaths.push(result);
      return;
    }

    await handleSigningError({
      signingResult,
      pdResponseUrl,
      appInstanceId,
      patientId,
      cxId,
    });
  });

  await Promise.allSettled(resultPromises);
  if (parsedResponsesBucket && resultS3PayloadsWithFilePaths.length > 0) {
    const handler = buildS3WriterHandler();
    await handler.writeToS3(
      resultS3PayloadsWithFilePaths.map(([filePath, payload]) => {
        return {
          serviceId: "ehex-patient-discovery-response",
          bucket: parsedResponsesBucket,
          filePath,
          payload,
        };
      })
    );
  }
}

async function handleSigningError({
  signingResult,
  pdResponseUrl,
  appInstanceId,
  patientId,
  cxId,
}: {
  signingResult: {
    gateway: XCPDGateway;
    outboundRequest: OutboundPatientDiscoveryReq;
    error: string;
  };
  pdResponseUrl: string;
  appInstanceId: string;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const errorResponse = handleSchemaErrorResponse({
    outboundRequest: signingResult.outboundRequest,
    gateway: signingResult.gateway,
    text: `Failed to sign SAML request: ${signingResult.error}`,
    responseHttpStatusCode: httpStatus.INTERNAL_SERVER_ERROR,
  });
  const log = getLog("createSignSendProcessXcpdRequests");

  const startTime = buildDayjs().toDate();
  try {
    await executeWithNetworkRetries(async () => axios.post(pdResponseUrl, errorResponse), {
      initialDelay: 100,
      maxAttempts: 5,
      httpCodesToRetry: defaultOptionsRequestNotAccepted.httpCodesToRetry,
      httpStatusCodesToRetry: defaultOptionsRequestNotAccepted.httpStatusCodesToRetry,
      log,
    });
  } catch (error) {
    const msg = "Failed to send PD error response to internal eHex endpoint";
    log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, { extra: { cxId, patientId, error: errorToString(error) } });
  } finally {
    await storeAuditLogForXcpd({
      request: {
        gateway: signingResult.gateway,
        signedRequest: "",
        queryByParameterXml: "",
        outboundRequest: signingResult.outboundRequest,
      },
      isPatientMatch: false,
      startTime,
      appInstanceId,
      patientId,
      cxId,
      statusCode: errorResponse.responseHttpStatusCode ?? httpStatus.INTERNAL_SERVER_ERROR,
      operationOutcome: errorResponse.operationOutcome,
    });
  }
}

async function createSignSendProcessSingleXcpdRequest({
  signedRequest,
  index,
  appInstanceId,
  pdResponseUrl,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  signedRequest: SignedXcpdRequest;
  index: number;
  appInstanceId: string;
  pdResponseUrl: string;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<[string, string] | undefined> {
  const log = getLog("createSignSendProcessSingleXcpdRequest");
  const startTime = buildDayjs().toDate();

  const result = await sendProcessXcpdRequest({
    signedRequest,
    samlCertsAndKeys,
    patientId,
    cxId,
    index,
  });

  try {
    await executeWithNetworkRetries(async () => axios.post(pdResponseUrl, result), {
      initialDelay: 100,
      maxAttempts: 5,
      httpCodesToRetry: defaultOptionsRequestNotAccepted.httpCodesToRetry,
      httpStatusCodesToRetry: defaultOptionsRequestNotAccepted.httpStatusCodesToRetry,
      log,
    });
  } catch (error) {
    const msg = "Failed to send PD response to internal eHex endpoint";
    const extra = { cxId, patientId, result };
    log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
    capture.error(msg, { extra: { ...extra, error: errorToString(error) } });
  }

  await storeAuditLogForXcpd({
    request: signedRequest,
    isPatientMatch: result.patientMatch ?? undefined,
    startTime,
    appInstanceId,
    patientId,
    cxId,
    statusCode: result.responseHttpStatusCode ?? httpStatus.OK,
    operationOutcome: result.operationOutcome,
    // TODO: 1601 - Consider adding the patient match details
  });

  if (parsedResponsesBucket) {
    const partitionDate = result.requestTimestamp
      ? new Date(Date.parse(result.requestTimestamp))
      : new Date();
    const filePath = createHivePartitionFilePath({
      cxId,
      patientId,
      keys: { stage: "pd" },
      date: partitionDate,
    });
    const extendedResult = {
      ...result,
      _date: partitionDate.toISOString().slice(0, 10),
      cxid: cxId,
      _stage: "pd",
    };
    return [filePath, JSON.stringify(extendedResult)];
  }
  return undefined;
}

export async function createSignSendProcessDqRequests({
  dqResponseUrl,
  dqRequests,
  samlCertsAndKeys,
  patientId,
  cxId,
  appInstanceId,
}: {
  dqResponseUrl: string;
  dqRequests: OutboundDocumentQueryReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  appInstanceId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkDQRequests({
    bulkBodyData: dqRequests,
    samlCertsAndKeys,
  });
  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    await createSignSendProcessSingleDqRequest({
      signedRequest,
      index,
      appInstanceId,
      dqResponseUrl,
      samlCertsAndKeys,
      patientId,
      cxId,
    });
  });
  await Promise.allSettled(resultPromises);
}

async function createSignSendProcessSingleDqRequest({
  signedRequest,
  index,
  appInstanceId,
  dqResponseUrl,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  signedRequest: SignedDqRequest;
  index: number;
  appInstanceId: string;
  dqResponseUrl: string;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const log = getLog("createSignSendProcessSingleDqRequest");
  const startTime = buildDayjs().toDate();

  const result = await sendProcessRetryDqRequest({
    signedRequest,
    samlCertsAndKeys,
    patientId,
    cxId,
    index,
  });

  try {
    await executeWithNetworkRetries(async () => axios.post(dqResponseUrl, result), {
      httpCodesToRetry: defaultOptionsRequestNotAccepted.httpCodesToRetry,
      httpStatusCodesToRetry: defaultOptionsRequestNotAccepted.httpStatusCodesToRetry,
      log,
    });
  } catch (error) {
    const msg = "Failed to send DQ response to internal eHex endpoint";
    const extra = { cxId, patientId, result };
    log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
    capture.error(msg, { extra: { ...extra, error: errorToString(error) } });
  }

  await storeAuditLogForDq({
    request: signedRequest,
    response: result,
    isSuccessfulResponse: isSuccessfulOutboundDocQueryResponse(result),
    startTime,
    appInstanceId,
    patientId,
    cxId,
    statusCode: result.responseHttpStatusCode ?? httpStatus.OK,
    operationOutcome: result.operationOutcome,
  });
}
export async function createSignSendProcessDrRequests({
  drResponseUrl,
  drRequests,
  samlCertsAndKeys,
  patientId,
  cxId,
  appInstanceId,
}: {
  drResponseUrl: string;
  drRequests: OutboundDocumentRetrievalReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
  appInstanceId: string;
}): Promise<void> {
  const signedRequests = createAndSignBulkDRRequests({
    bulkBodyData: drRequests,
    samlCertsAndKeys,
  });

  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    await createSignSendProcessSingleDrRequest({
      signedRequest,
      index,
      appInstanceId,
      drResponseUrl,
      samlCertsAndKeys,
      patientId,
      cxId,
    });
  });

  await Promise.allSettled(resultPromises);
}

async function createSignSendProcessSingleDrRequest({
  signedRequest,
  index,
  appInstanceId,
  drResponseUrl,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  signedRequest: SignedDrRequest;
  index: number;
  appInstanceId: string;
  drResponseUrl: string;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const log = getLog("createSignSendProcessSingleDrRequest");
  const startTime = buildDayjs().toDate();

  const result = await sendProcessRetryDrRequest({
    signedRequest,
    samlCertsAndKeys,
    patientId,
    cxId,
    index,
  });
  try {
    await executeWithNetworkRetries(async () => axios.post(drResponseUrl, result), {
      httpCodesToRetry: defaultOptionsRequestNotAccepted.httpCodesToRetry,
      httpStatusCodesToRetry: defaultOptionsRequestNotAccepted.httpStatusCodesToRetry,
      log,
    });
  } catch (error) {
    const msg = "Failed to send DR response to internal eHex endpoint";
    const extra = { cxId, patientId, result };
    log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
    capture.error(msg, { extra: { ...extra, error: errorToString(error) } });
  }

  await storeAuditLogForDr({
    request: signedRequest,
    response: result,
    isSuccessfulResponse: isSuccessfulOutboundDocRetrievalResponse(result),
    startTime,
    appInstanceId,
    patientId,
    cxId,
    statusCode: result.responseHttpStatusCode ?? httpStatus.OK,
    operationOutcome: result.operationOutcome,
  });
}
