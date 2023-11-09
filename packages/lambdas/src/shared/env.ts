import {
  EnvType,
  getEnvType,
  getEnvVar as coreGetEnvVar,
  getEnvVarOrFail as coreGetEnvVarOrFail,
} from "@metriport/core/util/env-var";

/**
 * @deprecated Use core's instead.
 */
export function getEnv(name: string) {
  return coreGetEnvVar(name);
}
/**
 * @deprecated Use core's instead.
 */
export function getEnvOrFail(name: string) {
  return coreGetEnvVarOrFail(name);
}

export function isProduction(): boolean {
  return getEnvType() === EnvType.production;
}

export function isSandbox(): boolean {
  return getEnvType() === EnvType.sandbox;
}

export function isStaging(): boolean {
  return getEnvType() === EnvType.staging;
}
