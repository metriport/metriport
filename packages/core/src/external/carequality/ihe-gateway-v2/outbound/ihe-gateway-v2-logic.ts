import {
  OutboundDocumentQueryReq,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { errorToString, executeWithNetworkRetries, executeWithRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { buildWriteToS3Handler } from "../../../../command/write-to-storage/s3/write-to-s3-factory";
import { createHivePartitionFilePath } from "../../../../domain/filename";
import { Config } from "../../../../util/config";
import { log as getLog, out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { SamlCertsAndKeys } from "../saml/security/types";
import { createAndSignBulkDQRequests, SignedDqRequest } from "./xca/create/iti38-envelope";
import { createAndSignBulkDRRequests, SignedDrRequest } from "./xca/create/iti39-envelope";
import { processDqResponse } from "./xca/process/dq-response";
import { processDrResponse } from "./xca/process/dr-response";
import { isRetryable as isRetryableXca } from "./xca/process/error";
import { sendSignedDqRequest } from "./xca/send/dq-requests";
import { sendSignedDrRequest } from "./xca/send/dr-requests";
import { createAndSignBulkXCPDRequests, SignedXcpdRequest } from "./xcpd/create/iti55-envelope";
import { isRetryable as isRetryableXcpd } from "./xcpd/process/error";
import { processXCPDResponse } from "./xcpd/process/xcpd-response";
import { sendSignedXcpdRequest } from "./xcpd/send/xcpd-requests";

dayjs.extend(duration);

const parsedResponsesBucket = Config.getIheParsedResponsesBucketName();

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
}): Promise<OutboundPatientDiscoveryResp> {
  async function sendAndProcess() {
    const response = await sendSignedXcpdRequest({
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
    });
  }

  return await executeWithRetries(sendAndProcess, {
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

export async function createSignSendProcessXCPDRequest({
  pdResponseUrl,
  xcpdRequest,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  pdResponseUrl: string;
  xcpdRequest: OutboundPatientDiscoveryReq;
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const log = getLog("createSignSendProcessXCPDRequest");
  const signedRequests = createAndSignBulkXCPDRequests(xcpdRequest, samlCertsAndKeys);
  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    const result = await sendProcessXcpdRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    if (result.patientMatch) {
      try {
        // TODO not sure if we should retry on timeout
        await executeWithNetworkRetries(async () => axios.post(pdResponseUrl, result), {
          initialDelay: 100,
          maxAttempts: 5,
          httpStatusCodesToRetry: [502, 504],
          log,
        });
      } catch (error) {
        const msg = "Failed to send PD response to internal CQ endpoint";
        const extra = { cxId, patientId, result };
        log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
        capture.error(msg, { extra: { ...extra, error } });
      }
    }
    if (parsedResponsesBucket) {
      try {
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
        const handler = buildWriteToS3Handler();
        await handler.processWriteToS3({
          serviceId: "cq-patient-discovery-response",
          bucket: parsedResponsesBucket,
          filePath,
          payload: JSON.stringify(extendedResult),
        });
      } catch (error) {
        const msg = "Failed to send PD response to S3";
        const extra = { cxId, patientId, result };
        log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
      }
    }
  });

  await Promise.allSettled(resultPromises);
}

export async function createSignSendProcessDqRequests({
  dqResponseUrl,
  dqRequestsGatewayV2,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  dqResponseUrl: string;
  dqRequestsGatewayV2: OutboundDocumentQueryReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const log = getLog("createSignSendProcessDqRequests");

  const signedRequests = createAndSignBulkDQRequests({
    bulkBodyData: dqRequestsGatewayV2,
    samlCertsAndKeys,
  });

  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    const result = await sendProcessRetryDqRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    try {
      // TODO not sure if we should retry on timeout
      await executeWithNetworkRetries(async () => axios.post(dqResponseUrl, result), {
        httpStatusCodesToRetry: [502, 504],
        log,
      });
    } catch (error) {
      const msg = "Failed to send DQ response to internal CQ endpoint";
      const extra = { cxId, patientId, result };
      log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
      capture.error(msg, { extra: { ...extra, error } });
    }
  });

  await Promise.allSettled(resultPromises);
}

export async function createSignSendProcessDrRequests({
  drResponseUrl,
  drRequestsGatewayV2,
  samlCertsAndKeys,
  patientId,
  cxId,
}: {
  drResponseUrl: string;
  drRequestsGatewayV2: OutboundDocumentRetrievalReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const log = getLog("createSignSendProcessDrRequests");
  const signedRequests = createAndSignBulkDRRequests({
    bulkBodyData: drRequestsGatewayV2,
    samlCertsAndKeys,
  });

  const resultPromises = signedRequests.map(async (signedRequest, index) => {
    const result = await sendProcessRetryDrRequest({
      signedRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
      index,
    });
    try {
      // TODO not sure if we should retry on timeout
      await executeWithNetworkRetries(async () => axios.post(drResponseUrl, result), {
        httpStatusCodesToRetry: [502, 504],
        log,
      });
    } catch (error) {
      const msg = "Failed to send DR response to internal CQ endpoint";
      const extra = { cxId, patientId, result };
      log(`${msg} - ${errorToString(error)} - ${JSON.stringify(extra)}`);
      capture.error(msg, { extra: { ...extra, error } });
    }
  });

  await Promise.allSettled(resultPromises);
}
