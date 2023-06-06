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
    throw new NoTokenError(
      `Missing '${Constants.TOKEN_PARAM}' query parameter! To learn more, go to the Connect Widget overview in our documentation.`
    );
  }
  return apiToken;
}

export function handleToken(token: string): void {
  if (isDemoToken(token)) {
    throw new DemoTokenError(
      "The Connect Widget is running in demo mode! You will not be able to connect providers unless you acquire a valid connect token. See Create Connect Token documentation for reference."
    );
  }
  if (!isTokenValid()) {
    throw new InvalidTokenError(
      "Your Connect Token is invalid. See Create Connect Token documentation for reference."
    );
  }
  isDemo = false;
}

function isTokenValid() {
  try {
    getApi().get("/connect/redirect", {
      params: { provider: "fitbit" },
    });
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
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
