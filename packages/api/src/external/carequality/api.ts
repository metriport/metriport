import {
  APIMode as CQAPIMode,
  CarequalityManagementAPIFhir,
  CarequalityManagementAPIImplFhir,
} from "@metriport/carequality-sdk";
import { Config } from "../../shared/config";

const cqApiMode = Config.isProdEnv()
  ? CQAPIMode.production
  : Config.isStaging()
  ? CQAPIMode.staging
  : CQAPIMode.dev;

export function makeCarequalityManagementAPIFhir(): CarequalityManagementAPIFhir {
  if (Config.isSandbox()) throw new Error("Carequality Management API not initialized");

  const cqManagementApiKey = Config.getCQManagementApiKey();
  const cqOrgCert = Config.getCQOrgCertificate();
  const cqOrgPrivateKey = Config.getCQOrgPrivateKey();
  const cqPrivateKeyPassword = Config.getCQOrgPrivateKeyPassword();

  return new CarequalityManagementAPIImplFhir({
    apiKey: cqManagementApiKey,
    apiMode: cqApiMode,
    orgCert: cqOrgCert,
    rsaPrivateKey: cqOrgPrivateKey,
    rsaPrivateKeyPassword: cqPrivateKeyPassword,
  });
}
