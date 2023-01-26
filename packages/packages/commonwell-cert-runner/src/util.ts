import * as dotenv from "dotenv";
dotenv.config();

export function getEnvOrFail(name) {
  const value = process.env[name];
  // console.log(process.env);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}
