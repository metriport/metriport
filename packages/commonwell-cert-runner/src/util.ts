import * as dotenv from "dotenv";
dotenv.config();

export function getEnv(name: string): string | undefined {
  return process.env[name];
}
export function getEnvOrFail(name: string): string {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

export function getCertificateContent(cert: string): string | undefined {
  const regex = /-+BEGIN CERTIFICATE-+([\s\S]+?)-+END CERTIFICATE-+/i;
  const matches = cert.match(regex);
  const content = matches && matches[1];
  if (content) {
    return content.replace(/\r\n|\n|\r/gm, "");
  }
  return undefined;
}

export function filterTruthy<T>(o: T | undefined | null): T | [] {
  return o ? o : [];
}

export function firstElementOrFail<T>(arr?: T[] | undefined, fieldName?: string): T {
  if (arr && arr.length > 0) return arr[0];
  throw new Error(`No first ${fieldName ? fieldName : "element"} on array`);
}
