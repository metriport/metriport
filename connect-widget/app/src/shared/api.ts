import axios from "axios";
import { URLSearchParams } from "url";
import Constants from "./constants";
import { getEnvVarOrFail, isLocalEnv, isSandbox } from "./util";

function buildBaseURL(searchParams: URLSearchParams): string {
  if (isLocalEnv()) {
    return getEnvVarOrFail("REACT_APP_API_URL");
  }
  return isSandbox(searchParams)
    ? getEnvVarOrFail("REACT_APP_SANDBOX_API_URL")
    : getEnvVarOrFail("REACT_APP_API_URL");
}

const api = axios.create();
let apiInitialized = false;

export const getApi = () => {
  if (!apiInitialized) throw new Error(`API not initialized`);
  return api;
};

// get the session token in query params
export function getApiToken(searchParams: URLSearchParams): string {
  const apiToken = searchParams.get(Constants.TOKEN_PARAM);
  if (!apiToken) {
    throw new Error(`Missing query param ${Constants.TOKEN_PARAM}!`);
  }
  return apiToken;
}

// get the session token in query params, and set in the API headers
export function setupApi(searchParams: URLSearchParams) {
  api.defaults.baseURL = buildBaseURL(searchParams);
  if (isLocalEnv()) {
    // insert the API token right into the headers, as we're bypassing
    // API Gateway in local envs
    api.defaults.headers.common["api-token"] = getApiToken(searchParams);
  } else {
    api.defaults.params = { state: getApiToken(searchParams) };
  }
  apiInitialized = true;
}
