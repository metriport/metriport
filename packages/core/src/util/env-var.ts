import { MetriportError } from "./error/metriport-error";

/**
 * @deprecated User @metriport/shared/common/env-var instead
 */
export enum EnvType {
  production = "production",
  sandbox = "sandbox",
  staging = "staging",
  development = "dev",
}

/**
 * @deprecated User @metriport/shared/common/env-var instead
 */
export const getEnvVar = (varName: string): string | undefined => process.env[varName];

/**
 * @deprecated User @metriport/shared/common/env-var instead
 */
export const getEnvVarOrFail = (varName: string): string => {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
};

/**
 * @deprecated User @metriport/shared/common/env-var instead
 */
export function getEnvType(): EnvType {
  const envType = getEnvVarOrFail("ENV_TYPE");
  const envTypeValues = Object.values(EnvType).map(v => v.toString());
  if (!envTypeValues.includes(envType)) {
    throw new MetriportError(`Invalid ENV_TYPE`, undefined, { envType });
  }
  return envType as EnvType;
}
