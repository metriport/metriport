import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import axios from "axios";
import { DOMParser } from "xmldom";
import { CCD_FILE_NAME } from "../../../domain/document/upload";
import { base64ToString } from "../../../util/base64";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
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

    if (!containsCcd(documentContents)) {
      log("No CCD found. Let's generate one.");
      const queryParams = {
        cxId,
        patientId,
      };
      const params = new URLSearchParams(queryParams).toString();
      const endpointUrl = `${apiUrl}/internal/docs/ccd`;
      const url = `${endpointUrl}?${params}`;
      await api.post(url);
      log("CCD generated. Fetching the document contents");
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

function containsCcd(extrinsicObjects: string[]) {
  // TODO: check s3 for the existence of _ccd.xml instead of parsing metadata xmls
  return extrinsicObjects.some(obj => {
    const parser = new DOMParser();
    const document = parser.parseFromString(obj, "text/xml");

    const externalIdentifiers = document.getElementsByTagName("ExternalIdentifier");
    for (let i = 0; i < externalIdentifiers.length; i++) {
      const externalId = externalIdentifiers[i];
      const value = externalId?.getAttribute("value");
      if (value) {
        const decodedValue = base64ToString(value);
        if (decodedValue.includes(`_${CCD_FILE_NAME}.xml`)) return true;
      }
    }
    return false;
  });
}
