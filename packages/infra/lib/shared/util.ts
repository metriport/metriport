import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";

export function isStaging(config: EnvConfig): boolean {
  return config.environmentType === EnvType.staging;
}
export function isProd(config: EnvConfig): boolean {
  return config.environmentType === EnvType.production;
}
export function isSandbox(config: EnvConfig): boolean {
  return config.environmentType === EnvType.sandbox;
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
