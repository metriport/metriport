import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import axios from "axios";
import { Config } from "../../../util/config";
import { capture } from "../../../util/notifications";

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

    let documentContents = await getDocumentContents(cxId, patientId);
    // TODO: Finding the CCDs by (CCD) is not the best way to achieve it... Let's maybe get each document's name, decode, and see if it ends with `_ccd.xml`
    if (!documentContents.some(doc => doc.includes("(CCD)"))) {
      log("No CCD found. Let's generate one.");
      const queryParams = {
        cxId,
        patientId,
      };
      const params = new URLSearchParams(queryParams).toString();
      const endpointUrl = `${apiUrl}/internal/docs/ccd`;
      const url = `${endpointUrl}?${params}`;
      await api.post(url);
      documentContents = await getDocumentContents(cxId, patientId);
    }

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
  const documentContents = await s3Utils.retrieveDocumentIdsFromS3(cxId, patientId, bucket);

  if (!documentContents.length) {
    const msg = `Error getting document contents`;
    capture.error(msg, { extra: { cxId, patientId } });
    throw new XDSRegistryError("Internal Server Error");
  }
  return documentContents;
}
