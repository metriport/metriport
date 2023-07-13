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
