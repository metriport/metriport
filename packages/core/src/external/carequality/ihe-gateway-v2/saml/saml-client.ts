import https from "https";
import { constants } from "crypto";
import axios from "axios";
import * as AWS from "aws-sdk";
import { SamlCertsAndKeys } from "./security/types";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { MetriportError } from "../../../../util/error/metriport-error";
import { creatMtomContentTypeAndPayload } from "../outbound/xca/mtom/builder";

const { log } = out("Saml Client");
const timeout = 120000;
let rejectUnauthorized = true;

export function setRejectUnauthorized(value: boolean): void {
  rejectUnauthorized = value;
}
export function getRejectUnauthorized(): boolean {
  return rejectUnauthorized;
}

export type SamlClientResponse = {
  response: string;
  success: boolean;
};

export async function getTrustedKeyStore(): Promise<string> {
  try {
    const s3 = new AWS.S3({ region: Config.getAWSRegion() });
    const trustBundleBucketName = Config.getCqTrustBundleBucketName();
    const envType = Config.isDev() || Config.isStaging() ? Config.STAGING_ENV : Config.PROD_ENV;
    const key = `trust_store_${envType}_aws.pem`;
    const response = await s3.getObject({ Bucket: trustBundleBucketName, Key: key }).promise();
    if (!response.Body) {
      log("Trust bundle not found.");
      throw new Error("Trust bundle not found.");
    }
    const trustBundle = response.Body.toString();
    return trustBundle;
  } catch (error) {
    const msg = `Error getting trust bundle`;
    log(`${msg}. Error: ${error}`);
    throw new MetriportError(msg, error);
  }
}

export async function sendSignedXml({
  signedXml,
  url,
  samlCertsAndKeys,
  trustedKeyStore,
}: {
  signedXml: string;
  url: string;
  samlCertsAndKeys: SamlCertsAndKeys;
  trustedKeyStore: string;
}): Promise<{ response: string; contentType: string }> {
  const agent = new https.Agent({
    rejectUnauthorized: getRejectUnauthorized(),
    requestCert: true,
    cert: samlCertsAndKeys.certChain,
    key: samlCertsAndKeys.privateKey,
    passphrase: samlCertsAndKeys.privateKeyPassword,
    ca: trustedKeyStore,
    ciphers: "DEFAULT:!DH",
    secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
  });

  const response = await axios.post(url, signedXml, {
    timeout: 120000,
    headers: {
      "Content-Type": "application/soap+xml;charset=UTF-8",
      Accept: "application/soap+xml",
      "Cache-Control": "no-cache",
    },
    httpsAgent: agent,
  });

  return { response: response.data, contentType: response.headers["content-type"] };
}

export async function sendSignedXmlMtom({
  signedXml,
  url,
  samlCertsAndKeys,
  trustedKeyStore,
}: {
  signedXml: string;
  url: string;
  samlCertsAndKeys: SamlCertsAndKeys;
  trustedKeyStore: string;
}): Promise<{ response: string; contentType: string }> {
  const agent = new https.Agent({
    rejectUnauthorized: getRejectUnauthorized(),
    requestCert: true,
    cert: samlCertsAndKeys.certChain,
    key: samlCertsAndKeys.privateKey,
    passphrase: samlCertsAndKeys.privateKeyPassword,
    ca: trustedKeyStore,
    ciphers: "DEFAULT:!DH",
    secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
  });

  const { contentType, payload } = creatMtomContentTypeAndPayload(signedXml);
  const response = await axios.post(url, payload, {
    timeout: timeout,
    headers: {
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    },
    httpsAgent: agent,
  });
  return { response: response.data, contentType: response.headers["content-type"] };
}
