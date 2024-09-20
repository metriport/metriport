import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import { CCD_SUFFIX, createUploadFilePath } from "../../../domain/document/upload";
import { getMetadataDocumentContents } from "../../../shareback/metadata/retrieve-metadata-xml";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { S3Utils } from "../../aws/s3";
import {
  IHEGatewayError,
  XDSRegistryError,
  XDSUnknownPatientId,
  constructDQErrorResponse,
} from "../error";
import { validateBasePayload } from "../shared";
import { decodePatientId } from "./utils";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const api = axios.create();
const bucket = Config.getMedicalDocumentsBucketName();

export async function processInboundDq(
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
        async () => await api.post(`${apiUrl}/internal/docs/empty-ccd?${params}`),
        { log }
      );

      log("CCD generated. Fetching the document contents");
    }

    const metadataDocumentContents = await getMetadataDocumentContents(cxId, patientId, false);
    const response: InboundDocumentQueryResp = {
      id: payload.id,
      patientId: payload.patientId,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      extrinsicObjectXmls: metadataDocumentContents,
      signatureConfirmation: payload.signatureConfirmation,
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
