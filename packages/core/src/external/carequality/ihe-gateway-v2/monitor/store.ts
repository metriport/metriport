import dayjs from "dayjs";
import {
  OutboundPatientDiscoveryReq,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  XCPDGateway,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { S3Utils } from "../../../aws/s3";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

const { log } = out("Storing IHE Responses");

const bucket = Config.getIheResponsesBucketName();
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
    if (!bucket) {
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
      bucket,
      key,
      file: Buffer.from(response),
      contentType: "application/xml",
    });
  } catch (error) {
    log(`Error storing XCPD response: ${error}`);
  }
}

export async function storeDqResponses({
  response,
  outboundRequest,
  gateway,
}: {
  response: string;
  outboundRequest: OutboundDocumentQueryReq;
  gateway: XCAGateway;
}) {
  try {
    if (!bucket) {
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
      bucket,
      key,
      file: Buffer.from(response),
      contentType: "application/xml",
    });
  } catch (error) {
    log(`Error storing DQ response: ${error}`);
  }
}

export async function storeDrResponses({
  response,
  outboundRequest,
  gateway,
}: {
  response: Buffer;
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: XCAGateway;
}) {
  try {
    if (!bucket) {
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
    });
    await s3Utils.uploadFile({ bucket, key, file: response, contentType: "application/xml" });
  } catch (error) {
    log(`Error storing DR response: ${error}`);
  }
}

export function buildIheResponseKey({
  type,
  cxId,
  patientId,
  requestId,
  oid,
  timestamp,
}: {
  type: "xcpd" | "dq" | "dr";
  cxId: string;
  patientId: string;
  requestId: string;
  oid: string;
  timestamp: string;
}) {
  const date = dayjs(timestamp).format("YYYY-MM-DD");
  return `${cxId}/${patientId}/${type}/${requestId}_${date}/${oid}.xml`;
}
