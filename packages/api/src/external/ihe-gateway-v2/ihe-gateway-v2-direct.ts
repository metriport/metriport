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
import { SamlCertsAndKeys } from "@metriport/core/external/carequality/ihe-gateway-v2/saml/security/types";
import { Config } from "../../shared/config";

const cqPath = "/internal/carequality";

export class IHEGatewayV2Direct extends IHEGatewayV2 {
  private samlCertsAndKeys: SamlCertsAndKeys;
  private pdResponseUrl: string;
  private dqResponseUrl: string;
  private drResponseUrl: string;

  constructor() {
    super();
    this.samlCertsAndKeys = {
      certChain: Config.getCQOrgCertificateIntermediate(),
      publicCert: Config.getCQOrgCertificate(),
      privateKey: Config.getCQOrgPrivateKey(),
      privateKeyPassword: Config.getCQOrgPrivateKeyPassword(),
    };
    this.pdResponseUrl = Config.getApiUrl() + cqPath + "/patient-discovery/response";
    this.dqResponseUrl = Config.getApiUrl() + cqPath + "/document-query/response";
    this.drResponseUrl = Config.getApiUrl() + cqPath + "/document-retrieval/response";
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
    await createSignSendProcessXCPDRequest({
      pdResponseUrl: this.pdResponseUrl,
      xcpdRequest: pdRequestGatewayV2,
      samlCertsAndKeys: this.samlCertsAndKeys,
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
    await createSignSendProcessDQRequests({
      dqResponseUrl: this.dqResponseUrl,
      dqRequestsGatewayV2,
      samlCertsAndKeys: this.samlCertsAndKeys,
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
  }): Promise<void> {
    await createSignSendProcessDRRequests({
      drResponseUrl: this.drResponseUrl,
      drRequestsGatewayV2,
      samlCertsAndKeys: this.samlCertsAndKeys,
      patientId,
      cxId,
    });
  }
}
