import { loadTrustedKeyStore } from "@metriport/core/external/ehex/ehex-gateway/saml/saml-client";
import { APIMode, EhexManagementApi, EhexManagementApiFhir } from "@metriport/ehex-sdk";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../shared/config";

let cachedTrustStore: string | undefined = undefined;

/**
 * Loads the Ehex trust bundle from S3 and caches it.
 */
async function loadEhexTrustBundle(): Promise<string> {
  if (cachedTrustStore) return cachedTrustStore;

  try {
    const trustBundle = await loadTrustedKeyStore();
    if (!trustBundle) throw new MetriportError("Trust bundle not found.");
    cachedTrustStore = trustBundle;
    return cachedTrustStore;
  } catch (error) {
    const msg = `Error getting eHex trust bundle`;
    throw new MetriportError(msg, error);
  }
}

/**
 * Creates a new instance of the Ehex Management API client based on the current environment.
 *
 * @returns Ehex API client or undefined if not supported in the current environment.
 */
export async function makeEhexManagementApi(): Promise<EhexManagementApi | undefined> {
  const apiMode = getApiMode();
  if (!apiMode) return undefined;
  const apiKey = Config.getEhexManagementApiKey();
  const trustBundle = await loadEhexTrustBundle();
  return new EhexManagementApiFhir({ apiKey, apiMode, options: { caTrustBundle: trustBundle } });
}

/**
 * Creates a new instance of the Ehex Management API client based on the current environment.
 *
 * @returns Ehex API client.
 * @throws Error if the API client cannot be initialized.
 */
export async function makeEhexManagementApiOrFail(): Promise<EhexManagementApi> {
  const api = await makeEhexManagementApi();
  if (!api) throw new Error("Ehex API not initialized");
  return api;
}

/**
 * Returns the API mode based on the current environment.
 * NOTE: Sandbox is not supported and returns undefined.
 */
function getApiMode(): APIMode | undefined {
  if (Config.isProdEnv()) return APIMode.production;
  if (Config.isStaging()) return APIMode.staging;
  if (Config.isDev()) return APIMode.dev;
  return undefined;
}
