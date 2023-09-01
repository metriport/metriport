import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import Axios from "axios";
import { customAlphabet } from "nanoid";
import { getEnvVarOrFail } from "../../shared/config";

export const nanoid = customAlphabet("1234567890abcdef", 10);

export const testApiKey = getEnvVarOrFail("TEST_API_KEY");

export const baseURL = getEnvVarOrFail("API_URL");
export const internalBaseURL = "http://localhost:8090";
export const stagingBaseUrl = "https://api.staging.metriport.com";

export const createApi = (url: string, apiKey?: string) =>
  Axios.create({
    timeout: 10_000,
    baseURL: url ? url : baseURL,
    headers: { "x-api-key": apiKey ? apiKey : testApiKey, "Content-Type": "application/json" },
  });

export const api = Axios.create({
  timeout: 10_000,
  baseURL: baseURL,
  headers: { "x-api-key": testApiKey, "Content-Type": "application/json" },
});
