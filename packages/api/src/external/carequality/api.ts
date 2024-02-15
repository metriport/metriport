import {
  CarequalityManagementAPI,
  CarequalityManagementAPIImpl,
  APIMode as CQAPIMode,
} from "@metriport/carequality-sdk";
import { IHEGateway, APIMode as IHEGatewayAPIMode } from "@metriport/ihe-gateway-sdk";
import { Config } from "../../shared/config";

const cqApiMode = Config.isProdEnv()
  ? CQAPIMode.production
  : Config.isStaging()
  ? CQAPIMode.staging
  : CQAPIMode.dev;

/**
 * Creates a new instance of the Carequality Management API client.
 * @returns Carequality API.
 */
export function makeCarequalityManagementAPI(): CarequalityManagementAPI | undefined {
  if (Config.isSandbox()) return;
  const cqDirectoryApiKey = Config.getCQDirectoryApiKey();
  const cqOrgCert = Config.getCQOrgCertificate();
  const cqOrgPrivateKey = Config.getCQOrgPrivateKey();
  const cqPrivateKeyPassword = Config.getCQOrgPrivateKeyPassword();

  return new CarequalityManagementAPIImpl({
    apiKey: cqDirectoryApiKey,
    apiMode: cqApiMode,
    orgCert: cqOrgCert,
    rsaPrivateKey: cqOrgPrivateKey,
    rsaPrivateKeyPassword: cqPrivateKeyPassword,
  });
}

/**
 * Creates a new instance of the IHE Gateway client.
 * @returns IHE Gateway client.
 */
export function makeIheGatewayAPI(): IHEGateway | undefined {
  if (Config.isSandbox() || Config.isProdEnv() || Config.isStaging()) {
    // TODO: #1350 - Remove this when we go live with CQ
    return;
  }

  return new IHEGateway(IHEGatewayAPIMode.dev);
}
