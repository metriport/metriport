import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import Axios from "axios";
import { customAlphabet } from "nanoid";
import { getEnvVarOrFail } from "../../../../../shared/config";

export const nanoid = customAlphabet("1234567890abcdef", 10);

const apiKey = getEnvVarOrFail("API_KEY");

export const baseURL = "http://0.0.0.0:8080";

export const fhirApi = Axios.create({
  baseURL,
  headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
});
