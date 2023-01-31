import * as dotenv from "dotenv";
dotenv.config();

export function getEnvOrFail(name) {
  const value = process.env[name];
  // console.log(process.env);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

export function getCertificateContent(cert: string): string | undefined {
  const regex = /-+BEGIN CERTIFICATE-+([\s\S]+?)-+END CERTIFICATE-+/i;
  const matches = cert.match(regex);
  if (matches && matches.length > 1) {
    const content = matches[1];
    return content.replace(/\r\n|\n|\r/gm, "");
  }
  return undefined;
}
