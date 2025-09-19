import { getCachedPrincipalAndDelegatesMap } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/principal-and-delegates-cache";
import { log } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";

export async function initializeCache(cacheInitialized: boolean): Promise<boolean> {
  if (!cacheInitialized) {
    try {
      await getCachedPrincipalAndDelegatesMap();
      log("Principal and delegates cache initialized successfully");
      return true;
    } catch (error) {
      log(`Failed to initialize principal and delegates cache: ${errorToString(error)}`);
      return false;
    }
  }
  return cacheInitialized;
}
