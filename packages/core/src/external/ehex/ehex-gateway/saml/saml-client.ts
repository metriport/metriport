import {
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
  NetworkError,
} from "@metriport/shared";
import * as AWS from "aws-sdk";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import https from "https";
import tls from "tls";
import { Config } from "../../../../util/config";
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

const httpCodesToRetry: NetworkError[] = ["ECONNREFUSED", "ECONNRESET", "ECONNABORTED"];

const httpCodesToRetryDocumentQuery: NetworkError[] = [...httpCodesToRetry, "ERR_BAD_RESPONSE"];

const httpCodesToRetryDocumentRetrieve: NetworkError[] = [...httpCodesToRetry, "ERR_BAD_RESPONSE"];

const initialDelay = dayjs.duration({ seconds: 3 });
const maxPayloadSize = Infinity;

let trustedStore: string | undefined = undefined;
async function getTrustedKeyStore(): Promise<string> {
  if (!trustedStore) trustedStore = await loadTrustedKeyStore();
  return trustedStore;
}

/**
 * Combines the default Node.js root certificates with the custom trust store.
 * This ensures that both system-trusted CAs and custom CAs (like self-signed
 * certificates used by eHex gateways) are trusted.
 */
function combineTrustStores(customTrustStore: string): string {
  const defaultRootCerts = tls.rootCertificates.join("\n");
  return `${defaultRootCerts}\n${customTrustStore}`;
}

export type SamlClientResponse = {
  response: string;
  success: boolean;
};
export async function loadTrustedKeyStore(): Promise<string> {
  try {
    const s3 = new AWS.S3({ region: Config.getAWSRegion() });
    const trustBundleBucketName = Config.getEhexTrustBundleBucketName();
    const envType = Config.isDev() || Config.isStaging() ? Config.STAGING_ENV : Config.PROD_ENV;
    const key = `ehex_trust_store_${envType}.pem`;
    const response = await s3.getObject({ Bucket: trustBundleBucketName, Key: key }).promise();
    if (!response.Body) {
      log("Trust bundle not found.");
      throw new MetriportError("Trust bundle not found.");
    }
    const trustBundle = response.Body.toString();
    return trustBundle;
  } catch (error) {
    const msg = `Error getting trust bundle`;
    log(`${msg}. Error: ${errorToString(error)}`);
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
}): Promise<{ response: string; responseStatus: number; contentType: string }> {
  const trustedKeyStore = await getTrustedKeyStore();
  const combinedTrustStore = combineTrustStores(trustedKeyStore);
  const agent = new https.Agent({
    rejectUnauthorized: true,
    requestCert: true,
    cert: samlCertsAndKeys.certChain,
    key: samlCertsAndKeys.privateKey,
    passphrase: samlCertsAndKeys.privateKeyPassword,
    ca: combinedTrustStore,
    ciphers: "DEFAULT:!DH",
    // This is set on CQ side, but it's insecure and we should remove it. Commenting it out so we can try it out w/ eHex.
    // secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
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
      httpCodesToRetry: httpCodesToRetryDocumentQuery,
      retryOnTimeout: true,
    });
  }

  const response = isDq ? await sendWithRetries() : await sendRequest();

  return {
    response: response.data,
    responseStatus: response.status,
    contentType: response.headers["content-type"] ?? response.headers["Content-Type"],
  };
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
  const combinedTrustStore = combineTrustStores(trustedKeyStore);
  const agent = new https.Agent({
    rejectUnauthorized: true,
    requestCert: true,
    cert: samlCertsAndKeys.certChain,
    key: samlCertsAndKeys.privateKey,
    passphrase: samlCertsAndKeys.privateKeyPassword,
    ca: combinedTrustStore,
    ciphers: "DEFAULT:!DH",
    // This is set on CQ side, but it's insecure and we should remove it. Commenting it out so we can try it out w/ eHex.
    // secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
  });

  const logger = getLog(`sendSignedXmlMtom, oid: ${oid}, requestChunkId: ${requestChunkId}`);
  const { contentType, payload } = createMtomContentTypeAndPayload(signedXml);
  const response = await executeWithNetworkRetries(
    async () => {
      try {
        logger(
          `Sending MTOM request to ${url}, timeout: ${httpTimeoutDocumentRetrieve.asMilliseconds()}ms`
        );
        const res = await axios.post(url, payload, {
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
        logger(
          `Received response, status: ${res.status}, content-length: ${
            res.headers["content-length"] ?? "unknown"
          }`
        );
        return res;
      } catch (error) {
        const errorMsg = errorToString(error);
        logger(`Request failed: ${errorMsg}`);
        throw new MetriportError(`MTOM request failed: ${errorMsg}`, error);
      }
    },
    {
      initialDelay: initialDelay.asMilliseconds(),
      maxAttempts: 4,
      httpCodesToRetry: httpCodesToRetryDocumentRetrieve,
      retryOnTimeout: true,
      log: logger,
    }
  );

  const binaryData: Buffer = Buffer.isBuffer(response.data)
    ? response.data
    : Buffer.from(response.data, "binary");

  if (binaryData.length === 0) {
    throw new MetriportError("Received empty response from server");
  }

  const boundary = getBoundaryFromMtomResponse(response.headers["content-type"]);
  if (boundary) {
    return { mtomParts: await parseMtomResponse(binaryData, boundary), rawResponse: binaryData };
  }
  return { mtomParts: convertSoapResponseToMtomResponse(binaryData), rawResponse: binaryData };
}
