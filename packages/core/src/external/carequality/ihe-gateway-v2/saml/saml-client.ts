import https from "https";
import { constants } from "crypto";
import axios from "axios";
import * as AWS from "aws-sdk";
import { SamlCertsAndKeys } from "./security/types";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { MetriportError } from "../../../../util/error/metriport-error";
const { log } = out("Saml Client");

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
    rejectUnauthorized: true,
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

export async function sendSignedXmlMTOM({
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
  const boundary = "MIMEBoundary782a6cafc4cf4aab9dbf291522804454";
  const agent = new https.Agent({
    rejectUnauthorized: false,
    cert: samlCertsAndKeys.certChain,
    key: samlCertsAndKeys.privateKey,
    passphrase: samlCertsAndKeys.privateKeyPassword,
    ca: trustedKeyStore,
    ciphers: "DEFAULT:!DH",
    secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
  });

  const payload = `--${boundary}\r\nContent-ID: <doc0@metriport.com>\r\nContent-Type: application/xop+xml; charset=UTF-8; type="application/soap+xml"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${signedXml}\r\n\r\n--${boundary}--`;

  const response = await axios.post(url, payload, {
    timeout: 120000,
    headers: {
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": `multipart/related; type="application/xop+xml"; start="<doc0@metriport.com>"; boundary=${boundary}; start-info="application/soap+xml"`,
      "Cache-Control": "no-cache",
    },
    httpsAgent: agent,
  });
  return { response: response.data, contentType: response.headers["content-type"] };
}
