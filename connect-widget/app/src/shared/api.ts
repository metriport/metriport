import axios from "axios";
import { URLSearchParams } from "url";
import Constants from "./constants";
import { NoTokenError, DemoTokenError, InvalidTokenError } from "./token-errors";
import { getEnvVarOrFail, isLocalEnv, isSandbox, isDemoToken } from "./util";

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
export let isDemo = true;

export const getApi = () => {
  if (!apiInitialized) throw new Error(`API not initialized`);
  return api;
};

// get the session token in query params
export function getApiToken(searchParams: URLSearchParams): string {
  const apiToken = searchParams.get(Constants.TOKEN_PARAM);
  if (!apiToken) {
    // tell the user the token is missing && disable connect buttons
    throw new NoTokenError();
  }
  return apiToken;
}

export function handleToken(token: string): void {
  if (isDemoToken(token)) {
    // tell the user the widget is in demo mode && disable connect buttons
    throw new DemoTokenError();
  }
  if (!isTokenValid()) {
    // tell the user the token is invalid and && disable connect buttons
    throw new InvalidTokenError();
  }

  // token is present and valid. Set isDemo to false
  isDemo = false;
}

async function isTokenValid() {
  try {
    await getApi().get("/connect/redirect", {
      params: { provider: "fitbit" }, // all we're trying to do here is confirm the token is valid. Doesn't matter which provider to use.
    });
  } catch (err) {
    return false;
  }

  return true;
}

// get the session token in query params, and set in the API headers
export function setupApi(searchParams: URLSearchParams) {
  api.defaults.baseURL = buildBaseURL(searchParams);
  const apiToken = getApiToken(searchParams);
  handleToken(apiToken);
  if (isLocalEnv()) {
    // insert the API token right into the headers, as we're bypassing
    // API Gateway in local envs
    api.defaults.headers.common["api-token"] = apiToken;
  } else {
    api.defaults.params = { state: apiToken };
  }
  apiInitialized = true;
}
