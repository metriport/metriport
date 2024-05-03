import { DocumentReference } from "@medplum/fhirtypes";
import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import axios from "axios";
import {
  createUploadFilePath,
  createUploadMetadataFilePath,
} from "../../../domain/document/upload";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { sizeInBytes } from "../../../util/string";
import { uuidv7 } from "../../../util/uuid-v7";
import { createAndUploadMetadataFile } from "../../aws/lambda-logic/document-uploader";
import { S3Utils } from "../../aws/s3";
import {
  IHEGatewayError,
  XDSRegistryError,
  XDSUnknownPatientId,
  constructDQErrorResponse,
} from "../error";
import { decodePatientId, findDocumentReferences } from "./find-document-reference";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const api = axios.create();
const bucket = Config.getMedicalDocumentsBucketName();

export async function processInboundDocumentQuery(
  payload: InboundDocumentQueryReq,
  apiUrl: string
): Promise<InboundDocumentQueryResp> {
  try {
    const id_pair = decodePatientId(payload.externalGatewayPatient.id);

    if (!id_pair) {
      throw new XDSUnknownPatientId("Patient ID is not valid");
    }
    const { cxId, id: patientId } = id_pair;

    const documentContents = await getDocumentContents(payload, apiUrl, cxId, patientId);

    const response: InboundDocumentQueryResp = {
      id: payload.id,
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

async function getDocumentContents(
  payload: InboundDocumentQueryReq,
  apiUrl: string,
  cxId: string,
  patientId: string
): Promise<string[]> {
  let documentContents = await findDocumentReferences(payload);
  if (!documentContents) {
    const endpointUrl = `${apiUrl}/internal/docs/ccd`;
    await createAndUploadCcdAndMetadata(cxId, patientId, endpointUrl);
    documentContents = await findDocumentReferences(payload);
  }
  if (!documentContents) {
    const msg = `Error getting document contents`;
    capture.error(msg, { extra: { cxId, patientId } });
    throw new XDSRegistryError("Internal Server Error");
  }
  return documentContents;
}

async function createAndUploadCcdAndMetadata(cxId: string, patientId: string, endpointUrl: string) {
  const { log } = out(`Generate CCD cxId: ${cxId}, patientId: ${patientId}`);
  const queryParams = {
    cxId,
    patientId,
  };
  const params = new URLSearchParams(queryParams).toString();
  const url = `${endpointUrl}?${params}`;

  const docId = uuidv7();
  const fileName = createUploadFilePath(cxId, patientId, `${docId}.xml`);

  try {
    const resp = await api.get(url);
    const ccd = resp.data as string;
    const ccdSize = sizeInBytes(ccd);
    await s3Utils.uploadFile(bucket, fileName, Buffer.from(ccd));
    log(`CCD uploaded into ${bucket} under this name: ${fileName}`);

    const docRef: DocumentReference = {
      resourceType: "DocumentReference",
      status: "current",
      subject: {
        reference: `Patient/${patientId}`,
      },
      type: {
        coding: [
          {
            code: "34133-9",
            display: "SUMMARIZATION OF EPISODE NOTE",
            system: "http://loinc.org",
          },
        ],
      },
      description: "Continuity of Care Document (C-CDA)",
    };

    const metadataFileName = createUploadMetadataFilePath(cxId, patientId, docId);
    await createAndUploadMetadataFile({
      s3Utils,
      cxId,
      patientId,
      docId: fileName,
      size: ccdSize.toString(),
      docRef,
      metadataFileName,
      destinationBucket: bucket,
      mimeType: "xml",
    });
  } catch (error) {
    const msg = `Error creating and uploading CCD`;
    log(`${msg}: error - ${error}`);
    capture.error(msg, { extra: { error, cxId, patientId, fileName, url } });
    throw error;
  }
}
