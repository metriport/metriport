import { getApiToken } from "./api";
import { NavigateFunction } from "react-router-dom";
import Constants from "./constants";

function buildEnvParam(envParam: string) {
  return `&${envParam}=true`;
}

// redirects to the main connect page while keeping the token state
export function redirectToMain(
  navigate: NavigateFunction,
  searchParams: URLSearchParams
) {
  let envParam = "";
  if (isSandbox(searchParams)) {
    envParam = buildEnvParam(Constants.SANDBOX_PARAM);
  } else if (isStaging(searchParams)) {
    envParam = buildEnvParam(Constants.STAGING_PARAM);
  }

  navigate(
    `/?${Constants.TOKEN_PARAM}=${getApiToken(searchParams)}${envParam}`
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

function isEnvParamSet(
  searchParams: URLSearchParams,
  envParam: string
): boolean {
  const isSet = searchParams.get(envParam);
  return isSet != null && isSet === String(true);
}

export function isSandbox(searchParams: URLSearchParams): boolean {
  return isEnvParamSet(searchParams, Constants.SANDBOX_PARAM);
}

export function isStaging(searchParams: URLSearchParams): boolean {
  return isEnvParamSet(searchParams, Constants.STAGING_PARAM);
}
