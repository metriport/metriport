import {
  EnvType,
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

export function getEnvTypeRaw(): string | undefined {
  return coreGetEnvVar("ENV_TYPE");
}

export function isProduction(): boolean {
  return getEnvTypeRaw() === EnvType.production;
}

export function isSandbox(): boolean {
  return getEnvTypeRaw() === EnvType.sandbox;
}

export function isStaging(): boolean {
  return getEnvTypeRaw() === EnvType.staging;
}
