import {
  OutboundPatientDiscoveryReq,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import { IHEGatewayV2 } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import {
  createSignSendProcessXCPDRequest,
  createSignSendProcessDQRequests,
  createSignSendProcessDRRequests,
} from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { Config } from "../../shared/config";

const pdResponseUrl = Config.getApiUrl() + "/internal/carequality/patient-discovery/response";
const dqResponseUrl = Config.getApiUrl() + "/internal/carequality/document-query/response";
const drResponseUrl = Config.getApiUrl() + "/internal/carequality/document-retrieval/response";

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
    const privateKey = Config.getCQOrgPrivateKey();
    const privateKeyPassword = Config.getCQOrgPrivateKeyPassword();
    const publicCert = Config.getCQOrgCertificate();
    const certChain = Config.getCQOrgCertificateIntermediate();

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

    await createSignSendProcessXCPDRequest({
      pdResponseUrl,
      xcpdRequest: pdRequestGatewayV2,
      publicCert,
      privateKey,
      privateKeyPassword,
      certChain,
      patientId,
      cxId,
    });
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
    // MAKE REUSABLE
    const privateKey = Config.getCQOrgPrivateKey();
    const privateKeyPassword = Config.getCQOrgPrivateKeyPassword();
    const publicCert = Config.getCQOrgCertificate();
    const certChain = Config.getCQOrgCertificateIntermediate();

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

    await createSignSendProcessDQRequests({
      dqResponseUrl,
      dqRequestsGatewayV2,
      publicCert: publicCert,
      privateKey: privateKey,
      privateKeyPassword: privateKeyPassword,
      certChain: certChain,
      patientId,
      cxId,
    });
  }
  async startDocumentRetrievalGatewayV2({
    drRequestsGatewayV2,
    patientId,
    cxId,
  }: {
    drRequestsGatewayV2: OutboundDocumentRetrievalReq[];
    patientId: string;
    cxId: string;
    requestId: string;
  }): Promise<void> {
    const privateKey = Config.getCQOrgPrivateKey();
    const privateKeyPassword = Config.getCQOrgPrivateKeyPassword();
    const publicCert = Config.getCQOrgCertificate();
    const certChain = Config.getCQOrgCertificateIntermediate();

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

    await createSignSendProcessDRRequests({
      drResponseUrl,
      drRequestsGatewayV2,
      publicCert: publicCert,
      privateKey: privateKey,
      privateKeyPassword: privateKeyPassword,
      certChain: certChain,
      patientId,
      cxId,
    });
  }
}
