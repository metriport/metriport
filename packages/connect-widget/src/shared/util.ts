import { NavigateFunction } from "react-router-dom";
import { getApiToken } from "./api";
import Constants from "./constants";

function buildEnvParam(envParam: string) {
  return `${envParam}=true`;
}

// redirects to the main connect page while keeping the token state
export function redirectToMain(navigate: NavigateFunction, searchParams: URLSearchParams) {
  try {
    const envParam = isSandbox(searchParams) ? `&${buildEnvParam(Constants.SANDBOX_PARAM)}` : "";
    navigate(`/?${Constants.TOKEN_PARAM}=${getApiToken(searchParams)}${envParam}`);
  } catch (err) {
    console.log("Error redirecting to main page: ", JSON.stringify(err));
  }
}

// redirects to the custom redirect url
export function redirectToCustomUrl(url: string) {
  try {
    window.location.href = url;
  } catch (err) {
    console.log("Error redirecting to custom url: ", JSON.stringify(err));
  }
}

/**
 * Checks to see if the app is running in a local development environment.
 *
 * @returns {boolean} True if the app is running in local/dev; false otherwise.
 */
export function isLocalEnv(): boolean {
  return process.env.NODE_ENV !== Constants.CLOUD_ENV;
}

function isEnvParamSet(searchParams: URLSearchParams, envParam: string): boolean {
  const isSet = searchParams.get(envParam);
  return isSet != null && isSet === String(true);
}

export function isSandbox(searchParams: URLSearchParams): boolean {
  return isEnvParamSet(searchParams, Constants.SANDBOX_PARAM);
}

export function getEnvType(): string {
  return getEnvVarOrFail("REACT_APP_ENV_TYPE");
}

export function getEnvVar(varName: string): string | undefined {
  return process.env[varName];
}

export function getEnvVarOrFail(varName: string): string {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
}

export function isDemoToken(token: string | null): boolean {
  return token === Constants.DEMO_TOKEN;
}

export const sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));
