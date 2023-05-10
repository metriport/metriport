import Axios from "axios";
import { customAlphabet } from "nanoid";

export const nanoid = customAlphabet("1234567890abcdef", 10);

// TODO: How to make this dynamic? Create an acc for every test?
const apiKey = "YThtMldReVhXdkF3eldXQ0lLR2ZVOjE1NDE0NTZmLTY3MzQtNDJhNS05ZWI3LWVmMGQ5OGIxMGQ0OQ";

export const baseURL = "http://0.0.0.0:8080";

export const fhirApi = Axios.create({
  baseURL,
  headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
});
