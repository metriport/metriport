import {
  DqRequestGatewayParams,
  DrRequestGatewayParams,
  EhexGateway,
  PdRequestGatewayParams,
} from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway";
import {
  createSignSendProcessDqRequests,
  createSignSendProcessDrRequests,
  createSignSendProcessXcpdRequests,
} from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway-logic";
import { SamlCertsAndKeys } from "@metriport/core/external/ehex/ehex-gateway/saml/security/types";
import { Config } from "../../shared/config";

const ehexPath = "/internal/ehex";

/**
 * TODO ENG-1601 Rename this to "..Local", it's not to be used in cloud environments.
 * Only to be used in local/development environment. For cloud environments that need synchronous execution,
 * call createSignSendProcessXcpdRequest directly, providing the appInstanceId based on the environment.
 */
export class EhexGatewayDirect extends EhexGateway {
  private samlCertsAndKeys: SamlCertsAndKeys;
  private pdResponseUrl: string;
  private dqResponseUrl: string;
  private drResponseUrl: string;

  constructor() {
    super();
    this.samlCertsAndKeys = {
      certChain: Config.getEhexOrgCertificateIntermediate(),
      publicCert: Config.getEhexOrgCertificate(),
      privateKey: Config.getEhexOrgPrivateKey(),
      privateKeyPassword: Config.getEhexOrgPrivateKeyPassword(),
    };
    this.pdResponseUrl = Config.getApiUrl() + ehexPath + "/patient-discovery/response";
    this.dqResponseUrl = Config.getApiUrl() + ehexPath + "/document-query/response";
    this.drResponseUrl = Config.getApiUrl() + ehexPath + "/document-retrieval/response";
  }

  async startPatientDiscovery({
    pdRequest,
    patientId,
    cxId,
  }: PdRequestGatewayParams): Promise<void> {
    await createSignSendProcessXcpdRequests({
      // This should always run from local
      appInstanceId: process.pid.toString(),
      pdResponseUrl: this.pdResponseUrl,
      xcpdRequest: pdRequest,
      samlCertsAndKeys: this.samlCertsAndKeys,
      patientId,
      cxId,
    });
  }

  async startDocumentQueryGateway({
    dqRequests,
    patientId,
    cxId,
  }: DqRequestGatewayParams): Promise<void> {
    await createSignSendProcessDqRequests({
      appInstanceId: process.pid.toString(),
      dqResponseUrl: this.dqResponseUrl,
      dqRequests,
      samlCertsAndKeys: this.samlCertsAndKeys,
      patientId,
      cxId,
    });
  }

  async startDocumentRetrievalGateway({
    drRequests,
    patientId,
    cxId,
  }: DrRequestGatewayParams): Promise<void> {
    await createSignSendProcessDrRequests({
      appInstanceId: process.pid.toString(),
      drResponseUrl: this.drResponseUrl,
      drRequests,
      samlCertsAndKeys: this.samlCertsAndKeys,
      patientId,
      cxId,
    });
  }
}
