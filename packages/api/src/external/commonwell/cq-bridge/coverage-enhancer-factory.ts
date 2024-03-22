import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { CoverageEnhancer } from "@metriport/core/external/commonwell/cq-bridge/coverage-enhancer";
import { makeApi } from "@metriport/core/external/commonwell/management/api-factory";
import { Config } from "../../../shared/config";
import { CoverageEnhancerApiLocal } from "./coverage-enhancer-api-local";

export function makeCoverageEnhancer(): CoverageEnhancer | undefined {
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
  const cwManagementApi = makeApi({ cookieManager, baseUrl: cwManagementUrl });
  const orgIdExcludeList = new Set<string>();
  return new CoverageEnhancerApiLocal(cwManagementApi, orgIdExcludeList);
}
