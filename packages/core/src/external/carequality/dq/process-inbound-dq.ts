import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import { CCD_SUFFIX, UPLOADS_FOLDER, createUploadFilePath } from "../../../domain/document/upload";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { S3Utils, executeWithRetriesS3 } from "../../aws/s3";
import {
  IHEGatewayError,
  XDSRegistryError,
  XDSUnknownPatientId,
  constructDQErrorResponse,
} from "../error";
import { validateBasePayload } from "../shared";
import { decodePatientId } from "./utils";
import { createFolderName } from "../../../domain/filename";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const api = axios.create();
const bucket = Config.getMedicalDocumentsBucketName();

export async function processInboundDocumentQuery(
  payload: InboundDocumentQueryReq,
  apiUrl: string
): Promise<InboundDocumentQueryResp> {
  try {
    validateBasePayload(payload);
    const id_pair = decodePatientId(payload.externalGatewayPatient.id);

    if (!id_pair) {
      throw new XDSUnknownPatientId("Patient ID is not valid");
    }
    const { cxId, id: patientId } = id_pair;
    const { log } = out(`Inbound DQ: ${cxId}, patientId: ${patientId}`);

    const destinationKey = createUploadFilePath(cxId, patientId, `${CCD_SUFFIX}.xml`);
    const ccdExists = await s3Utils.fileExists(bucket, destinationKey);
    if (!ccdExists) {
      log("No CCD found. Let's trigger generating one.");
      const queryParams = {
        cxId,
        patientId,
      };
      const params = new URLSearchParams(queryParams).toString();

      executeWithNetworkRetries(async () => api.post(`${apiUrl}/internal/docs/ccd?${params}`), {
        log,
      });
      await executeWithNetworkRetries(
        async () => await api.post(await api.post(`${apiUrl}/internal/docs/empty-ccd?${params}`)),
        { log }
      );

      log("CCD generated. Fetching the document contents");
    }

    const documentContents = await getDocumentContents(cxId, patientId);
    const response: InboundDocumentQueryResp = {
      id: payload.id,
      patientId: payload.patientId,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      extrinsicObjectXmls: documentContents,
    };
    return response;
  } catch (error) {
    if (error instanceof IHEGatewayError) {
      return constructDQErrorResponse(payload, error);
    } else {
      return constructDQErrorResponse(
        payload,
        new XDSRegistryError("Internal Server Error", error)
      );
    }
  }
}

async function getDocumentContents(cxId: string, patientId: string): Promise<string[]> {
  const documentContents = await retrieveXmlContentsFromMetadataFilesOnS3(cxId, patientId, bucket);

  if (!documentContents.length) {
    const msg = `Error getting document contents`;
    capture.error(msg, { extra: { cxId, patientId } });
    throw new XDSRegistryError("Internal Server Error");
  }
  return documentContents;
}

async function retrieveXmlContentsFromMetadataFilesOnS3(
  cxId: string,
  patientId: string,
  bucketName: string
): Promise<string[]> {
  const folderName = createFolderName(cxId, patientId);
  const Prefix = `${folderName}/${UPLOADS_FOLDER}/`;

  const params = {
    Bucket: bucketName,
    Prefix,
  };

  const data = await executeWithRetriesS3(() => s3Utils._s3.listObjectsV2(params).promise());
  const documentContents = (
    await Promise.all(
      data.Contents?.filter(item => item.Key && item.Key.endsWith("_metadata.xml")).map(
        async item => {
          if (item.Key) {
            const params = {
              Bucket: bucketName,
              Key: item.Key,
            };

            const data = await executeWithRetriesS3(() => s3Utils._s3.getObject(params).promise());
            return data.Body?.toString();
          }
          return undefined;
        }
      ) || []
    )
  ).filter((item): item is string => Boolean(item));

  return documentContents;
}
