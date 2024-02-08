import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";

export function isStagingEnv(env: EnvType): boolean {
  return env === EnvType.staging;
}
export function isProdEnv(env: EnvType): boolean {
  return env === EnvType.production;
}
export function isSandboxEnv(env: EnvType): boolean {
  return env === EnvType.sandbox;
}

export function isStaging(config: EnvConfig): boolean {
  return isStagingEnv(config.environmentType);
}
export function isProd(config: EnvConfig): boolean {
  return isProdEnv(config.environmentType);
}
export function isSandbox(config: EnvConfig): boolean {
  return isSandboxEnv(config.environmentType);
}
export function isLocalEnvironment(): boolean {
  return getEnvVar("LOCAL") !== undefined;
}

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
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
