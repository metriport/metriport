import { EnvConfig } from "./env-config";

export function getEHexEnvVars(
  eHexConfig: NonNullable<EnvConfig["ehex"]>,
  config: EnvConfig
): Record<string, string> {
  const ehexEnvVars = eHexConfig.envVars;
  if (!ehexEnvVars) return {};
  return {
    SYSTEM_ROOT_OID: config.systemRootOID,
    /** @deprecated */
    ...(ehexEnvVars.EHEX_ORG_URLS && {
      EHEX_ORG_URLS: ehexEnvVars.EHEX_ORG_URLS,
    }),
    ...(ehexEnvVars.EHEX_SERVICE_OWN_URLS && {
      EHEX_SERVICE_OWN_URLS: ehexEnvVars.EHEX_SERVICE_OWN_URLS,
    }),
    ...(ehexEnvVars.EHEX_URLS_TO_EXCLUDE && {
      EHEX_URLS_TO_EXCLUDE: ehexEnvVars.EHEX_URLS_TO_EXCLUDE,
    }),
    ...(ehexEnvVars.EHEX_ADDITIONAL_ORGS && {
      EHEX_ADDITIONAL_ORGS: JSON.stringify(ehexEnvVars.EHEX_ADDITIONAL_ORGS),
    }),
  };
}
