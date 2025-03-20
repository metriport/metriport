import crypto from "crypto";

export function verifyWebhookSignatureEd25519(
  key: string,
  body: object,
  signature: string
): boolean {
  const newKey = createPublicKey(key);
  const newBody = createJsonDumpsBody(body);
  const verified = crypto.verify(
    null,
    Buffer.from(newBody),
    newKey,
    Buffer.from(signature, "base64")
  );
  return verified;
}

function createPublicKey(key: string) {
  return `
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA${key}
-----END PUBLIC KEY-----
  `;
}

function createJsonDumpsBody(body: object) {
  return JSON.stringify(body).replace(/":/g, '": ').replace(/,"/g, ', "');
}
