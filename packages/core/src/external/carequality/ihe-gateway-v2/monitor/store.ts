import dayjs from "dayjs";
import {
  OutboundPatientDiscoveryReq,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  InboundPatientDiscoveryReq,
  InboundDocumentQueryReq,
  InboundDocumentRetrievalReq,
  InboundPatientDiscoveryResp,
  XCPDGateway,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { S3Utils } from "../../../aws/s3";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

const { log } = out("Storing IHE Req/Resp");

const bucketOutbound = Config.getIheResponsesBucketName();
const bucketInbound = Config.getIheRequestsBucketName();
let s3UtilsInstance = new S3Utils(Config.getAWSRegion());

function getS3UtilsInstance(): S3Utils {
  return s3UtilsInstance;
}
export function setS3UtilsInstance(s3Utils: S3Utils): void {
  s3UtilsInstance = s3Utils;
}

export async function storeXcpdResponses({
  response,
  outboundRequest,
  gateway,
}: {
  response: string;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}) {
  try {
    if (!bucketOutbound) {
      return;
    }
    const s3Utils = getS3UtilsInstance();
    const { cxId, patientId, id: requestId, timestamp } = outboundRequest;
    const key = buildIheResponseKey({
      type: "xcpd",
      cxId,
      patientId,
      requestId,
      oid: gateway.oid,
      timestamp,
    });
    await s3Utils.uploadFile({
      bucket: bucketOutbound,
      key,
      content: Buffer.from(response),
      contentType: "application/xml",
    });
  } catch (error) {
    log(`Error storing XCPD response: ${error}`);
  }
}

export async function storeDqResponse({
  response,
  outboundRequest,
  gateway,
}: {
  response: string;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
}) {
  try {
    if (!bucketOutbound) {
      return;
    }
    const s3Utils = getS3UtilsInstance();
    const { cxId, patientId, id: requestId, timestamp } = outboundRequest;
    const key = buildIheResponseKey({
      type: "dq",
      cxId,
      patientId,
      requestId,
      oid: gateway.homeCommunityId,
      timestamp,
    });
    await s3Utils.uploadFile({
      bucket: bucketOutbound,
      key,
      content: Buffer.from(response),
      contentType: "application/xml",
    });
  } catch (error) {
    log(`Error storing DQ response: ${error}`);
  }
}

export async function storeDrResponse({
  response,
  outboundRequest,
  gateway,
  requestChunkId,
}: {
  response: Buffer;
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
  requestChunkId?: string | undefined;
}) {
  try {
    if (!bucketOutbound) {
      return;
    }
    const s3Utils = getS3UtilsInstance();
    const { cxId, patientId, id: requestId, timestamp } = outboundRequest;
    const key = buildIheResponseKey({
      type: "dr",
      cxId,
      patientId,
      requestId,
      oid: gateway.homeCommunityId,
      timestamp,
      requestChunkId,
    });
    await s3Utils.uploadFile({
      bucket: bucketOutbound,
      key,
      content: response,
      contentType: "application/xml",
    });
  } catch (error) {
    log(`Error storing DR response: ${error}`);
  }
}

export async function storeXcpdRequest({
  request,
  inboundRequest,
}: {
  request: string;
  inboundRequest: InboundPatientDiscoveryReq;
}) {
  try {
    if (!bucketInbound) {
      return;
    }
    const s3Utils = getS3UtilsInstance();
    const key = buildIheRequestKey({
      type: "xcpd",
      requestId: inboundRequest.id,
      oid: inboundRequest.samlAttributes.homeCommunityId,
      timestamp: inboundRequest.timestamp,
      day: dayjs().format("YYYY-MM-DD"),
      extension: "xml",
    });
    await s3Utils.uploadFile({
      bucket: bucketInbound,
      key,
      content: Buffer.from(request),
      contentType: "application/xml",
    });
  } catch (error) {
    log(`Error storing XCPD response: ${error}`);
  }
}

export async function storeXcpdReqRespJson({
  inboundRequest,
  inboundResponse,
}: {
  inboundRequest: InboundPatientDiscoveryReq;
  inboundResponse: InboundPatientDiscoveryResp;
}) {
  try {
    if (!bucketInbound) {
      return;
    }
    const s3Utils = getS3UtilsInstance();
    const key = buildIheRequestKey({
      type: "xcpd",
      requestId: inboundRequest.id,
      oid: inboundRequest.samlAttributes.homeCommunityId,
      timestamp: inboundRequest.timestamp,
      day: dayjs().format("YYYY-MM-DD"),
      extension: "json",
    });
    const jsonData = {
      request: inboundRequest,
      response: inboundResponse,
    };
    await s3Utils.uploadFile({
      bucket: bucketInbound,
      key,
      content: Buffer.from(JSON.stringify(jsonData)),
      contentType: "application/json",
    });
  } catch (error) {
    log(`Error storing XCPD response: ${error}`);
  }
}

export async function storeDqRequest({
  request,
  inboundRequest,
}: {
  request: string;
  inboundRequest: InboundDocumentQueryReq;
}) {
  try {
    if (!bucketInbound) {
      return;
    }
    const s3Utils = getS3UtilsInstance();
    const key = buildIheRequestKey({
      type: "dq",
      requestId: inboundRequest.id,
      oid: inboundRequest.samlAttributes.homeCommunityId,
      timestamp: inboundRequest.timestamp,
      day: dayjs().format("YYYY-MM-DD"),
      extension: "xml",
    });
    await s3Utils.uploadFile({
      bucket: bucketInbound,
      key,
      content: Buffer.from(request),
      contentType: "application/xml",
    });
  } catch (error) {
    log(`Error storing XCPD response: ${error}`);
  }
}

export async function storeDrRequest({
  request,
  inboundRequest,
}: {
  request: string;
  inboundRequest: InboundDocumentRetrievalReq;
}) {
  try {
    if (!bucketInbound) {
      return;
    }
    const s3Utils = getS3UtilsInstance();
    const key = buildIheRequestKey({
      type: "dr",
      requestId: inboundRequest.id,
      oid: inboundRequest.samlAttributes.homeCommunityId,
      timestamp: inboundRequest.timestamp,
      day: dayjs().format("YYYY-MM-DD"),
      extension: "xml",
    });
    await s3Utils.uploadFile({
      bucket: bucketInbound,
      key,
      content: Buffer.from(request),
      contentType: "application/xml",
    });
  } catch (error) {
    log(`Error storing XCPD response: ${error}`);
  }
}

export function buildIheResponseKey({
  type,
  cxId,
  patientId,
  requestId,
  oid,
  timestamp,
  requestChunkId,
}: {
  type: "xcpd" | "dq" | "dr";
  cxId: string;
  patientId: string;
  requestId: string;
  oid: string;
  timestamp: string;
  requestChunkId?: string | undefined;
}) {
  const date = dayjs(timestamp).format("YYYY-MM-DD");
  const requestChunkIdPart = requestChunkId ? `_${requestChunkId}` : "";
  return `${cxId}/${patientId}/${type}/${requestId}_${date}/${oid}${requestChunkIdPart}.xml`;
}

export function buildIheRequestKey({
  type,
  oid,
  requestId,
  day,
  timestamp,
  extension,
}: {
  day: string;
  oid: string;
  type: "xcpd" | "dq" | "dr";
  requestId: string;
  timestamp: string;
  extension: "xml" | "json";
}) {
  const date = dayjs(timestamp).toISOString();
  return `${day}/${oid}/${type}/${requestId}_${date}.${extension}`;
}
