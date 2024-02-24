import {
  APIMode as CQAPIMode,
  CarequalityManagementAPI,
  CarequalityManagementAPIImpl,
} from "@metriport/carequality-sdk";
import { Config } from "../../shared/config";

const cqApiMode = Config.isProdEnv()
  ? CQAPIMode.production
  : Config.isStaging()
  ? CQAPIMode.staging
  : CQAPIMode.dev;

/**
 * Creates a new instance of the Carequality Management API client.
 *
 * @returns Carequality API.
 */
export function makeCarequalityManagementAPI(): CarequalityManagementAPI | undefined {
  if (Config.isSandbox()) return;

  const cqManagementApiKey = Config.getCQManagementApiKey();
  const cqOrgCert = Config.getCQOrgCertificate();
  const cqOrgPrivateKey = Config.getCQOrgPrivateKey();
  const cqPrivateKeyPassword = Config.getCQOrgPrivateKeyPassword();

  return new CarequalityManagementAPIImpl({
    apiKey: cqManagementApiKey,
    apiMode: cqApiMode,
    orgCert: cqOrgCert,
    rsaPrivateKey: cqOrgPrivateKey,
    rsaPrivateKeyPassword: cqPrivateKeyPassword,
  });
}
