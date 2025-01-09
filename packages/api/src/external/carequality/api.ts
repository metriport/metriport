import {
  APIMode as CqApiMode,
  CarequalityManagementAPI,
  CarequalityManagementApiFhir,
} from "@metriport/carequality-sdk";
import { Config } from "../../shared/config";

const cqApiMode = Config.isProdEnv()
  ? CqApiMode.production
  : Config.isStaging()
  ? CqApiMode.staging
  : CqApiMode.dev;

/**
 * Creates a new instance of the Carequality Management API client.
 *
 * @returns Carequality API.
 */
export function makeCarequalityManagementAPI(): CarequalityManagementAPI | undefined {
  if (Config.isSandbox()) return;

  const cqManagementApiKey = Config.getCQManagementApiKey();

  return new CarequalityManagementApiFhir({
    apiKey: cqManagementApiKey,
    apiMode: cqApiMode,
  });
}

export function makeCarequalityManagementAPIOrFail(): CarequalityManagementAPI {
  const api = makeCarequalityManagementAPI();
  if (!api) throw new Error("Carequality API not initialized");
  return api;
}
