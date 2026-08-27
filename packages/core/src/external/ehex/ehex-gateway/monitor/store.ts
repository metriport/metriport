import {
  InboundDocumentQueryReq,
  InboundDocumentQueryResp,
  InboundDocumentRetrievalReq,
  InboundDocumentRetrievalResp,
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  OutboundPatientDiscoveryReq,
  XCAGateway,
  XCPDGateway,
} from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import { buildDayjs, ISO_DATE } from "@metriport/shared/common/date";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { XML_APP_MIME_TYPE } from "../../../../util/mime";
import { capture } from "../../../../util/notifications";
import { S3Utils } from "../../../aws/s3";

const { log } = out("Storing eHex Req/Resp");

const bucketOutbound = Config.getEhexOutboundBucketName();
const bucketInbound = Config.getEhexInboundBucketName();
let s3UtilsInstance = new S3Utils(Config.getAWSRegion());

function getS3UtilsInstance(): S3Utils {
  return s3UtilsInstance;
}
export function setS3UtilsInstance(s3Utils: S3Utils): void {
  s3UtilsInstance = s3Utils;
}

type RequestObject =
  | InboundPatientDiscoveryReq
  | OutboundPatientDiscoveryReq
  | InboundDocumentQueryReq
  | OutboundDocumentQueryReq
  | InboundDocumentRetrievalReq
  | OutboundDocumentRetrievalReq;

async function safeStoreRequest({
  requestXml,
  requestObject,
  bucketName,
  type,
}: {
  requestXml: string;
  requestObject: RequestObject;
  bucketName: string | undefined;
  type: "xcpd" | "dq" | "dr";
}): Promise<void> {
  let key: string | undefined;
  try {
    if (!bucketName) return;
    key = buildIheRequestKey({
      type,
      requestId: requestObject.id,
      oid: requestObject.samlAttributes.homeCommunityId,
      timestamp: requestObject.timestamp,
      day: buildDayjs().format(ISO_DATE),
      extension: "xml",
    });
    const s3Utils = getS3UtilsInstance();
    await s3Utils.uploadFile({
      bucket: bucketName,
      key,
      file: Buffer.from(requestXml),
      contentType: XML_APP_MIME_TYPE,
    });
  } catch (error) {
    log(`Error storing ${type.toUpperCase()} request: ${errorToString(error)}`);
    capture.message(`Error storing EHEX request`, {
      extra: {
        type,
        key,
        bucketName,
        error: errorToString(error),
      },
      level: "warning",
    });
  }
}

export async function safeStoreInboundXcpdRequest({
  request,
  inboundRequest,
}: {
  request: string;
  inboundRequest: InboundPatientDiscoveryReq;
}): Promise<void> {
  return safeStoreRequest({
    requestXml: request,
    requestObject: inboundRequest,
    bucketName: bucketInbound,
    type: "xcpd",
  });
}

export async function safeStoreOutboundXcpdRequest({
  requestXml,
  outboundRequest,
}: {
  requestXml: string;
  outboundRequest: OutboundPatientDiscoveryReq;
}): Promise<void> {
  return safeStoreRequest({
    requestXml,
    requestObject: outboundRequest,
    bucketName: bucketOutbound,
    type: "xcpd",
  });
}

async function safeStoreReqRespJson({
  request,
  response,
  bucketName,
  type,
  direction,
}: {
  request: RequestObject;
  response: unknown;
  bucketName: string | undefined;
  type: "xcpd" | "dq" | "dr";
  direction: "inbound" | "outbound";
}) {
  let key: string | undefined;
  try {
    if (!bucketName) return;
    key = buildIheRequestKey({
      type,
      requestId: request.id,
      oid: request.samlAttributes.homeCommunityId,
      timestamp: request.timestamp,
      day: buildDayjs().format(ISO_DATE),
      extension: "json",
    });
    const s3Utils = getS3UtilsInstance();
    const jsonData = {
      request: request,
      response: response,
    };
    await s3Utils.uploadFile({
      bucket: bucketName,
      key,
      file: Buffer.from(JSON.stringify(jsonData)),
      contentType: "application/json",
    });
  } catch (error) {
    log(`Error storing ${direction} ${type.toUpperCase()} req/resp json: ${errorToString(error)}`);
    capture.message(`Error storing EHEX req/resp json`, {
      extra: {
        type,
        key,
        bucketName,
        direction,
        error: errorToString(error),
      },
      level: "warning",
    });
  }
}

export async function safeStoreInboundXcpdReqRespJson({
  inboundRequest,
  inboundResponse,
}: {
  inboundRequest: InboundPatientDiscoveryReq;
  inboundResponse: InboundPatientDiscoveryResp;
}) {
  return safeStoreReqRespJson({
    request: inboundRequest,
    response: inboundResponse,
    type: "xcpd",
    direction: "inbound",
    bucketName: bucketInbound,
  });
}

export async function safeStoreOutboundXcpdResponses({
  response,
  outboundRequest,
  gateway,
}: {
  response: string;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}) {
  const isDebugModeActive = Config.isDebugModeEnabled();
  if (!isDebugModeActive || !bucketOutbound) return;

  log(
    `Storing outbound XCPD resp - ptId: ${outboundRequest.patientId}, cxId: ${outboundRequest.cxId}, reqId: ${outboundRequest.id}`
  );
  const { cxId, patientId, id: requestId, timestamp } = outboundRequest;
  let key: string | undefined;

  try {
    key = buildIheResponseKey({
      type: "xcpd",
      cxId,
      patientId,
      requestId,
      oid: gateway.oid,
      timestamp,
    });
    const s3Utils = getS3UtilsInstance();
    await s3Utils.uploadFile({
      bucket: bucketOutbound,
      key,
      file: Buffer.from(response),
      contentType: XML_APP_MIME_TYPE,
    });
  } catch (error) {
    log(`Error storing XCPD response: ${errorToString(error)}`);
    capture.message(`Error storing EHEX response`, {
      extra: {
        type: "xcpd",
        key,
        bucketOutbound,
        error: errorToString(error),
      },
      level: "warning",
    });
  }
}

export async function safeStoreInboundDqRequest({
  requestXml,
  inboundRequest,
}: {
  requestXml: string;
  inboundRequest: InboundDocumentQueryReq;
}): Promise<void> {
  return safeStoreRequest({
    requestXml,
    requestObject: inboundRequest,
    bucketName: bucketInbound,
    type: "dq",
  });
}

export async function safeStoreOutboundDqRequest({
  requestXml,
  outboundRequest,
}: {
  requestXml: string;
  outboundRequest: OutboundDocumentQueryReq;
}): Promise<void> {
  return safeStoreRequest({
    requestXml,
    requestObject: outboundRequest,
    bucketName: bucketOutbound,
    type: "dq",
  });
}

export async function safeStoreInboundDqReqRespJson({
  inboundRequest,
  inboundResponse,
}: {
  inboundRequest: InboundDocumentQueryReq;
  inboundResponse: InboundDocumentQueryResp;
}) {
  return safeStoreReqRespJson({
    request: inboundRequest,
    response: inboundResponse,
    type: "dq",
    direction: "inbound",
    bucketName: bucketInbound,
  });
}

export async function safeStoreOutboundDqResponse({
  response,
  outboundRequest,
  gateway,
}: {
  response: string;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
}) {
  const { cxId, patientId, id: requestId, timestamp } = outboundRequest;
  let key: string | undefined;

  try {
    if (!bucketOutbound) return;
    key = buildIheResponseKey({
      type: "dq",
      cxId,
      patientId,
      requestId,
      oid: gateway.homeCommunityId,
      timestamp,
    });
    const s3Utils = getS3UtilsInstance();
    await s3Utils.uploadFile({
      bucket: bucketOutbound,
      key,
      file: Buffer.from(response),
      contentType: XML_APP_MIME_TYPE,
    });
  } catch (error) {
    log(`Error storing DQ response: ${errorToString(error)}`);
    capture.message(`Error storing EHEX response`, {
      extra: {
        type: "dq",
        key,
        bucketOutbound,
        error: errorToString(error),
      },
      level: "warning",
    });
  }
}

export async function safeStoreOutboundDrResponse({
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
  const { cxId, patientId, id: requestId, timestamp } = outboundRequest;
  let key: string | undefined;

  try {
    if (!bucketOutbound) return;
    key = buildIheResponseKey({
      type: "dr",
      cxId,
      patientId,
      requestId,
      oid: gateway.homeCommunityId,
      timestamp,
      requestChunkId,
    });
    const s3Utils = getS3UtilsInstance();
    await s3Utils.uploadFile({
      bucket: bucketOutbound,
      key,
      file: response,
      contentType: XML_APP_MIME_TYPE,
    });
  } catch (error) {
    log(`Error storing DR response: ${errorToString(error)}`);
    capture.message(`Error storing EHEX response`, {
      extra: {
        type: "dr",
        key,
        bucketOutbound,
        error: errorToString(error),
      },
      level: "warning",
    });
  }
}

export async function safeStoreInboundDrRequest({
  request,
  inboundRequest,
}: {
  request: string;
  inboundRequest: InboundDocumentRetrievalReq;
}): Promise<void> {
  return safeStoreRequest({
    requestXml: request,
    requestObject: inboundRequest,
    bucketName: bucketInbound,
    type: "dr",
  });
}

export async function safeStoreOutboundDrRequest({
  requestXml,
  outboundRequest,
}: {
  requestXml: string;
  outboundRequest: OutboundDocumentRetrievalReq;
}): Promise<void> {
  return safeStoreRequest({
    requestXml,
    requestObject: outboundRequest,
    bucketName: bucketOutbound,
    type: "dr",
  });
}

export async function safeStoreInboundDrReqRespJson({
  inboundRequest,
  inboundResponse,
}: {
  inboundRequest: InboundDocumentRetrievalReq;
  inboundResponse: InboundDocumentRetrievalResp;
}) {
  return safeStoreReqRespJson({
    request: inboundRequest,
    response: inboundResponse,
    type: "dr",
    direction: "inbound",
    bucketName: bucketInbound,
  });
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
  const date = buildDayjs(timestamp).format("YYYY-MM-DD");
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
  const date = buildDayjs(timestamp).toISOString();
  return `${day}/${oid}/${type}/${requestId}_${date}.${extension}`;
}
