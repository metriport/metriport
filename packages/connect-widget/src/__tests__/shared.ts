import { getEnvType, getEnvVar } from "../shared/util";

export const buildEnvVarName = (key: string, envType: string) => `${key}_${envType.toUpperCase()}`;

/**
 * While on dev, get these from .env.development[.local], just the key without the env suffix, e.g. DASH_URL.
 * While on Checkly, we get those from env vars on Checkly, with the env suffix, e.g. DASH_URL_STAGING.
 */
export function envVarForTest(key: string): string {
  const envKey = getEnvVar(key) ?? process.env[buildEnvVarName(key, getEnvType())];

  if (!envKey) {
    throw new Error(`Missing ${key} env var`);
  }

  return envKey;
}

export function getTestConfig() {
  return {
    apiUrl: envVarForTest("API_URL"),
    widgetUrl: envVarForTest("WIDGET_URL"),
    testApiKey: envVarForTest("WIDGET_TEST_API_KEY"),
  };
}
