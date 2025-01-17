import {
  APIMode,
  CarequalityManagementApi,
  CarequalityManagementApiFhir,
} from "@metriport/carequality-sdk";
import { Config } from "../../shared/config";

/**
 * Creates a new instance of the Carequality Management API client based on the current environment.
 *
 * @returns Carequality API client or undefined if not supported in the current environment.
 */
export function makeCarequalityManagementApi(): CarequalityManagementApi | undefined {
  const apiMode = getApiMode();
  if (!apiMode) return undefined;
  const apiKey = Config.getCQManagementApiKey();
  return new CarequalityManagementApiFhir({ apiKey, apiMode });
}

/**
 * Creates a new instance of the Carequality Management API client based on the current environment.
 *
 * @returns Carequality API client.
 * @throws Error if the API client cannot be initialized.
 */
export function makeCarequalityManagementApiOrFail(): CarequalityManagementApi {
  const api = makeCarequalityManagementApi();
  if (!api) throw new Error("Carequality API not initialized");
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
