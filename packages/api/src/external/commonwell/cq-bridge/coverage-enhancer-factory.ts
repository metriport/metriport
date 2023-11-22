import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { CoverageEnhancer } from "@metriport/core/external/commonwell/cq-bridge/coverage-enhancer";
// import { CoverageEnhancerCloud } from "@metriport/core/external/commonwell/cq-bridge/coverage-enhancer-cloud";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import { Config } from "../../../shared/config";
import { CoverageEnhancerApiLocal } from "./coverage-enhancer-api-local";

export function makeCoverageEnhancer(): CoverageEnhancer | undefined {
  // if (Config.isCloudEnv()) {
  //   const cwPatientLinkQueueUrl = Config.getCWPatientLinkQueueUrl();
  //   if (!cwPatientLinkQueueUrl) {
  //     console.log(`Could not return a CoverageEnhancer, mising cwPatientLinkQueueUrl`);
  //     return undefined;
  //   }
  //   return new CoverageEnhancerCloud(Config.getAWSRegion(), cwPatientLinkQueueUrl);
  // }

  const cwManagementUrl = Config.getCWManagementUrl();
  if (!cwManagementUrl) {
    console.log(`WARNING: Could not return a CoverageEnhancer, mising cwManagementUrl`);
    return undefined;
  }
  const cookieArn = Config.getCWManagementCookieArn();
  if (!cookieArn) {
    console.log(`WARNING: Could not return a CoverageEnhancer, mising cwManagementCookieArn`);
    return undefined;
  }
  const cookieManager = new CookieManagerOnSecrets(cookieArn, Config.getAWSRegion());
  const cwManagementApi = new CommonWellManagementAPI({
    cookieManager,
    baseUrl: cwManagementUrl,
  });
  return new CoverageEnhancerApiLocal(cwManagementApi);
}
