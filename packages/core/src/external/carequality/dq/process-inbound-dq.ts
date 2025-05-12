import { InboundDocumentQueryReq, InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { ensureCcdExists } from "../../../shareback/ensure-ccd-exists";
import { getMetadataDocumentContents } from "../../../shareback/metadata/get-metadata-xml";
import { out } from "../../../util/log";
import { constructDQErrorResponse, IHEGatewayError, XDSRegistryError } from "../error";
import { validateBasePayload } from "../shared";
import { decodePatientId } from "./utils";

export async function processInboundDq(
  payload: InboundDocumentQueryReq
): Promise<InboundDocumentQueryResp> {
  try {
    validateBasePayload(payload);

    const id_pair = decodePatientId(payload.externalGatewayPatient.id);
    const { cxId, patientId } = id_pair;
    const { log } = out(`Inbound DQ: ${cxId}, patientId: ${patientId}`);

    await ensureCcdExists({ cxId, patientId, log });

    const metadataDocumentContents = await getMetadataDocumentContents(cxId, patientId);
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
