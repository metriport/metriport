import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import Axios from "axios";
import { customAlphabet } from "nanoid";
import { getEnvVarOrFail, getEnvVar } from "../../shared/config";
import { Config } from "../../shared/config";

export const nanoid = customAlphabet("1234567890abcdef", 10);

export const testApiKey = getEnvVarOrFail("TEST_API_KEY");

export const baseURL = getEnvVarOrFail("API_URL");

// Used locally
export const internalUrl = getEnvVar("STAGING_INTERNAL_API_URL");

export function getCognitoBaseURL(): string {
  const isStaging = Config.isProdEnv();
  const isDev = !Config.isCloudEnv();

  return isStaging ? baseURL : isDev ? internalUrl || "" : "";
}

export function getInternalBaseUrl(): string {
  const isCloudEnv = Config.isCloudEnv();

  return isCloudEnv ? baseURL : "http://localhost:8090";
}

export const apiCognito = Axios.create({ baseURL: getCognitoBaseURL() });
export const apiInternal = Axios.create({ baseURL: getInternalBaseUrl() });
export const api = Axios.create({
  timeout: 10_000,
  baseURL: baseURL,
  headers: { "x-api-key": testApiKey, "Content-Type": "application/json" },
});
