import { Config } from "../../shared/config";
import { Carequality, APIMode } from "@metriport/carequality-sdk";

/**
 * Creates a new instance of the Carequality API client.
 * @param apiKey Optional, API key to use for authentication. If not used, the API key will be retrieved from the environment variables.
 * @param dev Optiona, creates the API in dev mode.
 * @returns Carequality API.
 */
export function makeCarequalityAPI(apiKey?: string, dev = false): Carequality {
  const cqApiKey = apiKey ?? Config.getCQApiKey();
  if (dev) return new Carequality(cqApiKey, APIMode.dev);
  if (Config.isSandbox()) {
    return new Carequality(cqApiKey, APIMode.staging);
  }
  return new Carequality(cqApiKey);
}
