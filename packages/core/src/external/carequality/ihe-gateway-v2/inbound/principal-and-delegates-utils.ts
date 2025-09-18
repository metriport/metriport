import { out } from "../../../../util/log";
import {
  isPrincipalAndDelegatesCacheLoaded,
  refreshPrincipalAndDelegatesCache,
} from "./principal-and-delegates-cache";

/**
 * Utility functions for managing the principal and delegates cache.
 * These can be used for monitoring, debugging, or manual cache management.
 */

/**
 * Get the current cache status for monitoring purposes.
 */
export function getCacheStatus(): { isLoaded: boolean; status: string } {
  const isLoaded = isPrincipalAndDelegatesCacheLoaded();
  return {
    isLoaded,
    status: isLoaded ? "loaded" : "not_loaded",
  };
}

/**
 * Force refresh the cache and return the result.
 * Useful for manual cache management or testing.
 */
export async function forceRefreshCache(): Promise<{ success: boolean; error?: string }> {
  const { log } = out("forceRefreshCache");

  try {
    await refreshPrincipalAndDelegatesCache();
    log("Cache refresh completed successfully");
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Cache refresh failed: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if the cache is healthy and ready to use.
 * This can be used for health checks or monitoring.
 */
export async function isCacheHealthy(): Promise<boolean> {
  try {
    const status = getCacheStatus();
    return status.isLoaded;
  } catch {
    return false;
  }
}
