import {
  OutboundPatientDiscoveryReq,
  OutboundDocumentQueryReq,
  isSuccessfulOutboundDocQueryResponse,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { IHEGatewayV2 } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import {
  createSignSendProcessXCPDRequest,
  createSignSendProcessDQRequests,
} from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { emptyFunction } from "@metriport/shared";
import { createOutboundPatientDiscoveryResp } from "../carequality/command/outbound-resp/create-outbound-patient-discovery-resp";
import { processPostRespOutboundPatientDiscoveryResps } from "../carequality/process-subsequent-outbound-patient-discovery-resps";
import { createOutboundDocumentQueryResp } from "../carequality/command/outbound-resp/create-outbound-document-query-resp";
import { getPDResultStatus, getDQResultStatus } from "../carequality/ihe-result";
import { Config } from "../../shared/config";

const privateKey = Config.getCQOrgPrivateKey();
const privateKeyPassword = Config.getCQOrgPrivateKeyPassword();
const publicCert = Config.getCQOrgCertificate();
const certChain = Config.getCQOrgCertificateIntermediate();

export class IHEGatewayV2Direct extends IHEGatewayV2 {
  constructor() {
    super();
  }
  async startPatientDiscovery({
    pdRequestGatewayV2,
    patientId,
    cxId,
  }: {
    pdRequestGatewayV2: OutboundPatientDiscoveryReq;
    patientId: string;
    cxId: string;
  }): Promise<void> {
    if (
      !privateKey ||
      typeof privateKey !== "string" ||
      !privateKeyPassword ||
      typeof privateKeyPassword !== "string" ||
      !publicCert ||
      typeof publicCert !== "string" ||
      !certChain ||
      typeof certChain !== "string"
    ) {
      throw new Error("Failed to get secrets or one of the secrets is not a string.");
    }

    const results = await createSignSendProcessXCPDRequest({
      xcpdRequest: pdRequestGatewayV2,
      publicCert,
      privateKey,
      privateKeyPassword,
      certChain,
      patientId,
      cxId,
    });

    for (const result of results) {
      await createOutboundPatientDiscoveryResp({
        id: uuidv7(),
        requestId: result.id,
        patientId: result.patientId,
        status: getPDResultStatus(result),
        response: result,
      });
      if (result.patientId && result.cxId) {
        processPostRespOutboundPatientDiscoveryResps({
          requestId: result.id,
          patientId: result.patientId,
          cxId: result.cxId,
        }).catch(emptyFunction);
      }
    }
  }
  async startDocumentQueryGatewayV2({
    dqRequestsGatewayV2,
    patientId,
    cxId,
  }: {
    dqRequestsGatewayV2: OutboundDocumentQueryReq[];
    patientId: string;
    cxId: string;
  }): Promise<void> {
    if (
      !privateKey ||
      typeof privateKey !== "string" ||
      !privateKeyPassword ||
      typeof privateKeyPassword !== "string" ||
      !publicCert ||
      typeof publicCert !== "string" ||
      !certChain ||
      typeof certChain !== "string"
    ) {
      throw new Error("One or more required secrets are undefined.");
    }

    const results = await createSignSendProcessDQRequests({
      dqRequestsGatewayV2,
      publicCert: publicCert,
      privateKey: privateKey,
      privateKeyPassword: privateKeyPassword,
      certChain: certChain,
      patientId,
      cxId,
    });

    let status = "failure";
    for (const result of results) {
      if (isSuccessfulOutboundDocQueryResponse(result)) {
        status = getDQResultStatus({
          docRefLength: result.documentReference?.length,
        });
      }
      await createOutboundDocumentQueryResp({
        id: uuidv7(),
        requestId: result.id,
        patientId: result.patientId,
        status,
        response: result,
      });
    }
  }
  async startDocumentRetrievalGatewayV2({
    drRequestsGatewayV2,
    patientId,
    cxId,
  }: {
    drRequestsGatewayV2: OutboundDocumentRetrievalReq[];
    patientId: string;
    cxId: string;
  }): Promise<void> {
    throw new Error(`Method not implemented. ${drRequestsGatewayV2}, ${patientId}, ${cxId}`);
  }
}
