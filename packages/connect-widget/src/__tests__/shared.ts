import { getEnvType, getEnvVar } from "../shared/util";

export const buildEnvVarName = (key: string, envType: string) => `${key}_${envType.toUpperCase()}`;

/**
 * While on dev, get these from .env.development[.local], just the key without the env suffix, e.g. DASH_URL.
 * While on Checkly, we get those from env vars on Checkly, with the env suffix, e.g. DASH_URL_STAGING.
 */
export function envVarForTest(key: string): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return getEnvVar(key) ?? process.env[buildEnvVarName(key, getEnvType())]!;
}

export function getTestConfig() {
  return {
    apiUrl: envVarForTest("REACT_APP_API_URL"),
    widgetUrl: envVarForTest("REACT_APP_WIDGET_URL"),
    testApiKey: envVarForTest("TEST_API_KEY"),
  };
}
