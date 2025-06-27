import { MetriportError } from "../error/metriport-error";

export enum EnvType {
  production = "production",
  sandbox = "sandbox",
  staging = "staging",
  development = "dev",
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

export function getEnvAsIntOrFail(varName: string): number {
  const value = getEnvVarOrFail(varName);
  const int = parseInt(value);
  if (isNaN(int)) {
    throw new Error(`${varName} env var is not a number`);
  }
  return int;
}

export function getEnvVarAsRecordOrFail(varName: string): Record<string, string> {
  const value = getEnvVarOrFail(varName);
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch (error) {
    throw new Error(`Failed to parse ${varName} env var`);
  }
}

export function getEnvType(): EnvType {
  const envType = getEnvVarOrFail("ENV_TYPE");
  const envTypeValues = Object.values(EnvType).map(v => v.toString());
  if (!envTypeValues.includes(envType)) {
    throw new MetriportError(`Invalid ENV_TYPE`, undefined, { envType });
  }
  return envType as EnvType;
}
