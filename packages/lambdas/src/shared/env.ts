export function getEnv(name: string) {
  return process.env[name];
}
export function getEnvOrFail(name: string) {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}
