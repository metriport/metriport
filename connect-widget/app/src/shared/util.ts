import { getApiToken } from "./api";
import { NavigateFunction } from "react-router-dom";
import Constants from "./constants";

// redirects to the main connect page while keeping the token state
export function redirectToMain(
  navigate: NavigateFunction,
  searchParams: URLSearchParams
) {
  const sandboxFlag = isSandbox(searchParams) ? "&sandbox=true" : "";
  navigate(
    `/?${Constants.TOKEN_PARAM}=${getApiToken(searchParams)}${sandboxFlag}`
  );
}

/**
 * Checks to see if the app is running in a production environment.
 *
 * @returns {boolean} True if the app is running in prod; false otherwise.
 */
export function isProdEnv(): boolean {
  return process.env.NODE_ENV === Constants.PROD_ENV;
}

export function isSandbox(searchParams: URLSearchParams): boolean {
  const isSandbox = searchParams.get(Constants.SANDBOX_PARAM);
  return isSandbox != null && isSandbox === String(true);
}
