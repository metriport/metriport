import { CookieManager } from "../../../domain/auth/cookie-management/cookie-manager";
import { Config } from "../../../util/config";
import { CommonWellManagementAPI } from "./api";
import { CommonWellManagementAPIImpl } from "./api-impl";
import { CommonWellManagementAPIMock } from "./api-mock";

export function makeApi({
  cookieManager,
  baseUrl,
}: {
  cookieManager: CookieManager;
  baseUrl: string;
}): CommonWellManagementAPI {
  return Config.isDev()
    ? new CommonWellManagementAPIMock({ baseUrl })
    : new CommonWellManagementAPIImpl({ cookieManager, baseUrl });
}
