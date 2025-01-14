import { executeWithNetworkRetries, NetworkError } from "@metriport/shared";
import * as AWS from "aws-sdk";
import axios from "axios";
import { constants } from "crypto";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import https from "https";
import { Config } from "../../../../util/config";
import { MetriportError } from "../../../../util/error/metriport-error";
import { log as getLog, out } from "../../../../util/log";
import { createMtomContentTypeAndPayload } from "../outbound/xca/mtom/builder";
import {
  convertSoapResponseToMtomResponse,
  getBoundaryFromMtomResponse,
  MtomAttachments,
  parseMtomResponse,
} from "../outbound/xca/mtom/parser";
import { SamlCertsAndKeys } from "./security/types";

dayjs.extend(duration);

const { log } = out("Saml Client");
const httpTimeoutPatientDiscovery = dayjs.duration({ seconds: 60 });
const httpTimeoutDocumentQuery = dayjs.duration({ seconds: 120 });
const httpTimeoutDocumentRetrieve = dayjs.duration({ seconds: 120 });

const httpCodesToRetry: NetworkError[] = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNABORTED",
];

const httpCodesToRetryDocumentQuery: NetworkError[] = [...httpCodesToRetry, "ERR_BAD_RESPONSE"];

const httpCodesToRetryDocumentRetrieve: NetworkError[] = [...httpCodesToRetry, "ERR_BAD_RESPONSE"];

const initialDelay = dayjs.duration({ seconds: 3 });
const maxPayloadSize = Infinity;
let rejectUnauthorized = true;
let trustedStore: string | undefined = undefined;
async function getTrustedKeyStore(): Promise<string> {
  if (!trustedStore) trustedStore = await loadTrustedKeyStore();
  return trustedStore;
}

/*
 * ONLY use this function for testing purposes. It will turn off SSL Verification of the server if set to false.
 * See saml-server.ts for usage.
 */
export function setRejectUnauthorized(value: boolean): void {
  rejectUnauthorized = value;
}
// TODO: remove false here once allscripts patches their endpoints
export function getRejectUnauthorized(): boolean {
  return false && rejectUnauthorized;
}

export type SamlClientResponse = {
  response: string;
  success: boolean;
};
async function loadTrustedKeyStore(): Promise<string> {
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
  isDq,
}: {
  signedXml: string;
  url: string;
  samlCertsAndKeys: SamlCertsAndKeys;
  isDq: boolean;
}): Promise<{ response: string; contentType: string }> {
  const trustedKeyStore = await getTrustedKeyStore();
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

  async function sendRequest() {
    return axios.post(url, signedXml, {
      timeout: isDq
        ? httpTimeoutDocumentQuery.asMilliseconds()
        : httpTimeoutPatientDiscovery.asMilliseconds(),
      headers: {
        "Content-Type": "application/soap+xml;charset=UTF-8",
        Accept: "application/soap+xml",
        "Cache-Control": "no-cache",
      },
      httpsAgent: agent,
      maxBodyLength: maxPayloadSize,
      maxContentLength: maxPayloadSize,
    });
  }

  async function sendWithRetries() {
    return executeWithNetworkRetries(sendRequest, {
      initialDelay: initialDelay.asMilliseconds(),
      maxAttempts: 4,
      //TODO: This introduces retry on timeout without needing to specify the http Code: https://github.com/metriport/metriport/pull/2285. Remove once PR is merged
      httpCodesToRetry: httpCodesToRetryDocumentQuery,
    });
  }

  const response = isDq ? await sendWithRetries() : await sendRequest();

  return { response: response.data, contentType: response.headers["content-type"] };
}

export async function sendSignedXmlMtom({
  signedXml,
  url,
  samlCertsAndKeys,
  oid,
  requestChunkId,
}: {
  signedXml: string;
  url: string;
  samlCertsAndKeys: SamlCertsAndKeys;
  oid: string;
  requestChunkId: string | undefined;
}): Promise<{ mtomParts: MtomAttachments; rawResponse: Buffer }> {
  const trustedKeyStore = await getTrustedKeyStore();
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

  const logger = getLog(`sendSignedXmlMtom, oid: ${oid}, requestChunkId: ${requestChunkId}`);
  const { contentType, payload } = createMtomContentTypeAndPayload(signedXml);
  const response = await executeWithNetworkRetries(
    async () => {
      return axios.post(url, payload, {
        timeout: httpTimeoutDocumentRetrieve.asMilliseconds(),
        headers: {
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
        httpsAgent: agent,
        responseType: "arraybuffer",
        maxBodyLength: maxPayloadSize,
        maxContentLength: maxPayloadSize,
      });
    },
    {
      initialDelay: initialDelay.asMilliseconds(),
      maxAttempts: 4,
      //TODO: This introduces retry on timeout without needing to specify the http Code: https://github.com/metriport/metriport/pull/2285. Remove once PR is merged
      httpCodesToRetry: httpCodesToRetryDocumentRetrieve,
      log: logger,
    }
  );

  const binaryData: Buffer = Buffer.isBuffer(response.data)
    ? response.data
    : Buffer.from(response.data, "binary");

  if (binaryData.length === 0) {
    throw new Error("Received empty response from server");
  }

  const boundary = getBoundaryFromMtomResponse(response.headers["content-type"]);
  if (boundary) {
    return { mtomParts: await parseMtomResponse(binaryData, boundary), rawResponse: binaryData };
  }
  return { mtomParts: convertSoapResponseToMtomResponse(binaryData), rawResponse: binaryData };
}
