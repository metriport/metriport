import { MetriportError } from "@metriport/shared";
import crypto from "crypto";

const ed25519Prefix = "MCowBQYDK2VwAyEA";

// Interpreted from Elation dosc https://docs.elationhealth.com/reference/webhooks
export function verifyWebhookSignatureEd25519Elation(
  key: string,
  rawBody: string,
  signature: string
): boolean {
  const newKey = createPublicKey(key);
  const verified = crypto.verify(
    null,
    Buffer.from(rawBody),
    newKey,
    Buffer.from(signature, "base64")
  );
  return verified;
}

function createPublicKey(key: string) {
  return `
-----BEGIN PUBLIC KEY-----
${ed25519Prefix}${key}
-----END PUBLIC KEY-----
  `;
}

// From Healthie docs https://docs.gethealthie.com/guides/webhooks/
async function getSigningKey(secretKey: string): Promise<crypto.webcrypto.CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
}

function constructDataToSign({
  method,
  path,
  query,
  headers,
  body,
}: {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}) {
  const contentDigestHeader = headers["content-digest"];
  if (!contentDigestHeader) throw new MetriportError("Content digest is required");
  const actualContentDigest = contentDigestHeader.split("=")[1];
  const contentType = "application/json";
  const contentLength = new Blob([JSON.stringify(body)]).size;
  return `${method.toLowerCase()} ${path} ${query} ${actualContentDigest} ${contentType} ${contentLength}`;
}

async function generateSignature(key: crypto.webcrypto.CryptoKey, data: string) {
  const encoder = new TextEncoder();
  const signature = await crypto.webcrypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyWebhookSignatureHealthie({
  secretKey,
  ...requestParams
}: {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  secretKey: string;
}) {
  const key = await getSigningKey(secretKey);
  const dataToSign = constructDataToSign(requestParams);
  const computedSignature = await generateSignature(key, dataToSign);
  const signatureHeader = requestParams.headers["signature"];
  if (!signatureHeader) throw new MetriportError("Signature is required");
  const actualSignature = signatureHeader.split("=")[1];
  if (!actualSignature) throw new MetriportError("Signature is required");
  return computedSignature === actualSignature;
}
