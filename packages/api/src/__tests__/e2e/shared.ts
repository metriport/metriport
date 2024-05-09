import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import Axios from "axios";
import { customAlphabet } from "nanoid";
import { getEnvVarOrFail } from "../../shared/config";

export const nanoid = customAlphabet("1234567890abcdef", 10);

export const testApiKey = getEnvVarOrFail("TEST_API_KEY");

export const baseURL = getEnvVarOrFail("API_URL");

export const api = Axios.create({
  timeout: 10_000,
  baseURL,
  headers: { "x-api-key": testApiKey, "Content-Type": "application/json" },
});
