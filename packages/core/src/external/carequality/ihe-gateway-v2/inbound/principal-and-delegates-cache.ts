import { errorToString } from "@metriport/shared";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { getPrincipalAndDelegatesMap } from "./principal-and-delegates";

/**
 * Cache for principal and delegates map to avoid repeated S3 calls in Lambda.
 * This data is only updated during CQ directory rebuilds, so it's safe to cache
 * at the Lambda level and reuse across invocations.
 */
class PrincipalAndDelegatesCache {
  private static instance: PrincipalAndDelegatesCache;
  private cache: Map<string, string[]> | undefined;
  private isLoading = false;
  private loadPromise: Promise<Map<string, string[]>> | undefined;

  static getInstance(): PrincipalAndDelegatesCache {
    if (!PrincipalAndDelegatesCache.instance) {
      PrincipalAndDelegatesCache.instance = new PrincipalAndDelegatesCache();
    }
    return PrincipalAndDelegatesCache.instance;
  }

  /**
   * Get the principal and delegates map from cache or load it if not cached.
   * This method is safe to call multiple times - it will only load once.
   */
  async getMap(): Promise<Map<string, string[]>> {
    if (this.cache) {
      return this.cache;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.loadMapFromS3();

    try {
      this.cache = await this.loadPromise;
      return this.cache;
    } catch (error) {
      this.isLoading = false;
      this.loadPromise = undefined;
      throw error;
    }
  }

  /**
   * Force refresh the cache by reloading from S3.
   * This should be called when the principal and delegates data is updated.
   */
  async refresh(): Promise<void> {
    const { log } = out(`PrincipalAndDelegatesCache.refresh`);
    log("Refreshing principal and delegates cache");

    this.cache = undefined;
    this.isLoading = false;
    this.loadPromise = undefined;

    try {
      await this.getMap();
      log("Successfully refreshed principal and delegates cache");
    } catch (error) {
      const msg = "Failed to refresh principal and delegates cache";
      log(`${msg}: ${errorToString(error)}`);
      capture.error(msg, { extra: { error } });
      throw error;
    }
  }

  /**
   * Check if the cache is currently loaded.
   */
  isLoaded(): boolean {
    return this.cache !== undefined;
  }

  private async loadMapFromS3(): Promise<Map<string, string[]>> {
    const { log } = out(`PrincipalAndDelegatesCache.loadMapFromS3`);
    log("Loading principal and delegates map from S3");

    try {
      const map = await getPrincipalAndDelegatesMap();
      log(`Successfully loaded principal and delegates map with ${map.size} entries`);
      return map;
    } catch (error) {
      const msg = "Failed to load principal and delegates map from S3";
      log(`${msg}: ${errorToString(error)}`);
      capture.error(msg, { extra: { error } });
      throw error;
    }
  }
}

/**
 * Get the cached principal and delegates map.
 * This function should be used instead of calling getPrincipalAndDelegatesMap directly
 * in Lambda functions to benefit from caching.
 */
export async function getCachedPrincipalAndDelegatesMap(): Promise<Map<string, string[]>> {
  return PrincipalAndDelegatesCache.getInstance().getMap();
}

/**
 * Refresh the cached principal and delegates map.
 * This should be called when the data is updated (e.g., after CQ directory rebuild).
 */
export async function refreshPrincipalAndDelegatesCache(): Promise<void> {
  return PrincipalAndDelegatesCache.getInstance().refresh();
}

/**
 * Check if the principal and delegates cache is loaded.
 */
export function isPrincipalAndDelegatesCacheLoaded(): boolean {
  return PrincipalAndDelegatesCache.getInstance().isLoaded();
}
