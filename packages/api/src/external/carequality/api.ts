import { Config } from "../../shared/config";
import { Carequality } from "@metriport/carequality-sdk";

/**
 * Creates a new instance of the Carequality API client.
 * @param apiKey Optional, API key to use for authentication. If not used, the API key will be retrieved from the environment variables.
 * @returns Carequality API.
 */
export function makeCarequalityAPI(apiKey?: string): Carequality | undefined {
  if (Config.isSandbox()) {
    return;
  }
  const cqApiKey = apiKey ?? Config.getCQApiKey();
  return new Carequality(cqApiKey);
}
