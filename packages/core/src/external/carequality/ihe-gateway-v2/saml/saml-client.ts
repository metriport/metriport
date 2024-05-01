import https from "https";
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
}): Promise<string> {
  const agent = new https.Agent({
    rejectUnauthorized: true,
    cert: samlCertsAndKeys.certChain,
    key: samlCertsAndKeys.privateKey,
    passphrase: samlCertsAndKeys.privateKeyPassword,
    ca: trustedKeyStore,
  });

  const response = await axios.post(url, signedXml, {
    headers: {
      "Content-Type": "application/soap+xml;charset=UTF-8",
      "Cache-Control": "no-cache",
    },
    httpsAgent: agent,
  });

  return response.data;
}
