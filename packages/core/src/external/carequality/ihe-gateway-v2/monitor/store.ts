import {
  OutboundPatientDiscoveryReq,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  XCPDGateway,
  XCAGateway,
} from "@metriport/ihe-gateway-sdk";
import { S3Utils } from "../../../aws/s3";
import { Config } from "../../../../util/config";

const bucket = Config.getIheResponsesBucketName();
let s3UtilsInstance = new S3Utils(Config.getAWSRegion());

function getS3UtilsInstance(): S3Utils {
  return s3UtilsInstance;
}
export function setS3UtilsInstanceForStoringIheResponse(s3Utils: S3Utils): void {
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
  if (!bucket) {
    return;
  }
  const s3Utils = getS3UtilsInstance();
  const { cxId, patientId, id: requestId } = outboundRequest;
  const key = buildIheResponseKey({ type: "xcpd", cxId, patientId, requestId, oid: gateway.oid });
  await s3Utils.uploadFile({
    bucket,
    key,
    file: Buffer.from(response),
    contentType: "application/xml",
  });
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
  if (!bucket) {
    return;
  }
  const s3Utils = getS3UtilsInstance();
  const { cxId, patientId, id: requestId } = outboundRequest;
  const key = buildIheResponseKey({
    type: "dq",
    cxId,
    patientId,
    requestId,
    oid: gateway.homeCommunityId,
  });
  await s3Utils.uploadFile({
    bucket,
    key,
    file: Buffer.from(response),
    contentType: "application/xml",
  });
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
  if (!bucket) {
    return;
  }
  const s3Utils = getS3UtilsInstance();
  const { cxId, patientId, id: requestId } = outboundRequest;
  const key = buildIheResponseKey({
    type: "dr",
    cxId,
    patientId,
    requestId,
    oid: gateway.homeCommunityId,
  });
  await s3Utils.uploadFile({ bucket, key, file: response, contentType: "application/xml" });
}

function buildIheResponseKey({
  type,
  cxId,
  patientId,
  requestId,
  oid,
}: {
  type: "xcpd" | "dq" | "dr";
  cxId: string;
  patientId: string;
  requestId: string;
  oid: string;
}) {
  return `${type}/${cxId}/${patientId}/${requestId}/${oid}.xml`;
}
