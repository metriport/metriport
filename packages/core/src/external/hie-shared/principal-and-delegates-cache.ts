import { errorToString } from "@metriport/shared";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { getPrincipalAndDelegatesMap } from "./principal-and-delegates";

/**
 * Cache for principal and delegates map to avoid repeated S3 calls in each Lambda invocation.
 * This data is only updated during CQ directory rebuilds, so it's safe to cache
 * at the Lambda level and reuse across invocations.
 */
class LambdaOnlyDelegateCache {
  private static instances: Map<string, LambdaOnlyDelegateCache> = new Map();
  private cache: Map<string, string[]> | undefined;
  private source: "cq" | "cw";

  private constructor(source: "cq" | "cw") {
    this.source = source;
  }

  static getInstance(source: "cq" | "cw"): LambdaOnlyDelegateCache {
    if (!LambdaOnlyDelegateCache.instances.has(source)) {
      LambdaOnlyDelegateCache.instances.set(source, new LambdaOnlyDelegateCache(source));
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return LambdaOnlyDelegateCache.instances.get(source)!;
  }

  /**
   * Get the principal and delegates map from cache or load it if not cached.
   *
   * Since this is only used in Lambda, we don't need to worry about multiple calls issueing separate requests to S3.
   */
  async getMap(): Promise<Map<string, string[]>> {
    if (this.cache) {
      return this.cache;
    }

    this.cache = await this.loadMapFromS3();
    return this.cache;
  }

  private async loadMapFromS3(): Promise<Map<string, string[]>> {
    const { log } = out(`PrincipalAndDelegatesCache.loadMapFromS3`);
    log("Loading principal and delegates map from S3");

    try {
      const map = await getPrincipalAndDelegatesMap(this.source);
      log(`Successfully loaded principal and delegates map with ${map.size} entries`);
      return map;
    } catch (error) {
      const msg = "Failed to load principal and delegates map from S3";
      log(`${msg}: ${errorToString(error)}`);
      capture.setExtra({ loadMapFromS3Error: errorToString(error) });
      throw error;
    }
  }
}

/**
 * Get the cached principal and delegates map.
 * This function should be used instead of calling getPrincipalAndDelegatesMap directly
 * in Lambda functions to benefit from caching.
 */
export async function getCachedPrincipalAndDelegatesMap(
  source: "cq" | "cw"
): Promise<Map<string, string[]>> {
  return LambdaOnlyDelegateCache.getInstance(source).getMap();
}
