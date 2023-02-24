export const getEnvVar = (varName: string): string | undefined => process.env[varName];

export const getEnvVarOrFail = (varName: string): string => {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
};

export class Config {
  // env config
  static readonly PROD_ENV: string = "production";
  static readonly DEV_ENV: string = "dev";
  static readonly SANDBOX_ENV: string = "sandbox";
  static readonly SANDBOX_USER_LIMIT: number = 10;
  static isProdEnv(): boolean {
    return process.env.NODE_ENV === this.PROD_ENV;
  }
  static isSandbox(): boolean {
    return process.env.ENV_TYPE === this.SANDBOX_ENV;
  }
  static getConnectWidgetUrl(): string {
    return getEnvVarOrFail("CONNECT_WIDGET_URL");
  }

  static getConnectRedirectUrl(): string {
    if (this.isProdEnv()) {
      return `${Config.getApiUrl()}/token/connect`;
    }

    // Garmin requires an internet accessible address - use a proxy like NGrok or similar
    return `${Config.getApiUrl()}/connect`;
  }

  static getApiUrl(): string {
    return getEnvVarOrFail("API_URL");
  }

  static getCronometerClientId(): string {
    return getEnvVarOrFail("CRONOMETER_CLIENT_ID");
  }
  static getCronometerClientSecret(): string {
    return getEnvVarOrFail("CRONOMETER_CLIENT_SECRET");
  }

  static getGarminConsumerKey(): string {
    return getEnvVarOrFail("GARMIN_CONSUMER_KEY");
  }
  static getGarminConsumerSecret(): string {
    return getEnvVarOrFail("GARMIN_CONSUMER_SECRET");
  }

  static getOuraClientId(): string {
    return getEnvVarOrFail("OURA_CLIENT_ID");
  }
  static getOuraClientSecret(): string {
    return getEnvVarOrFail("OURA_CLIENT_SECRET");
  }

  static getFitbitClientId(): string {
    return getEnvVarOrFail("FITBIT_CLIENT_ID");
  }
  static getFitbitClientSecret(): string {
    return getEnvVarOrFail("FITBIT_CLIENT_SECRET");
  }

  static getGoogleClientId(): string {
    return getEnvVarOrFail("GOOGLE_CLIENT_ID");
  }
  static getGoogleClientSecret(): string {
    return getEnvVarOrFail("GOOGLE_CLIENT_SECRET");
  }

  static getWhoopClientId(): string {
    return getEnvVarOrFail("WHOOP_CLIENT_ID");
  }
  static getWhoopClientSecret(): string {
    return getEnvVarOrFail("WHOOP_CLIENT_SECRET");
  }

  static getWithingsClientId(): string {
    return getEnvVarOrFail("WITHINGS_CLIENT_ID");
  }
  static getWithingsClientSecret(): string {
    return getEnvVarOrFail("WITHINGS_CLIENT_SECRET");
  }

  static getUsageUrl(): string | undefined {
    return getEnvVar("USAGE_URL");
  }

  static getFHIRServerUrl(): string | undefined {
    return getEnvVar("FHIR_SERVER_URL");
  }

  static getSystemRootOID(): string {
    return getEnvVarOrFail("SYSTEM_ROOT_OID");
  }
}
