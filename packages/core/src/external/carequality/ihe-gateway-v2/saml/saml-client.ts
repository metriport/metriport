import https from "https";
import { MultipartParser } from "formidable";
import { constants } from "crypto";
import axios from "axios";
import fs from "fs";
import * as AWS from "aws-sdk";
import { SamlCertsAndKeys } from "./security/types";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { MetriportError } from "../../../../util/error/metriport-error";
import { creatMtomContentTypeAndPayload } from "../outbound/xca/mtom/builder";
import { detectFileType } from "../../../../util/file-type";

const { log } = out("Saml Client");
const timeout = 120000;
let rejectUnauthorized = true;

/*
 * ONLY use this function for testing purposes. It will turn off SSL Verification of the server if set to false.
 * See saml-server.ts for usage.
 */
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
    responseType: "arraybuffer",
  });

  try {
    const mtomContentType = parseMtomContentType(response.headers["content-type"]);
    const binaryData: Buffer = Buffer.isBuffer(response.data)
      ? response.data
      : Buffer.from(response.data, "binary");
    fs.writeFileSync("../../scratch/dr/raw", binaryData);
    console.log("mtomContentType", mtomContentType);
    const mtomParts = await parseMTOMResp(binaryData, mtomContentType.boundary);
    const soapData: Buffer = mtomParts.parts[0]?.body || Buffer.from("");
    const fileData: Buffer = mtomParts.parts[1]?.body || Buffer.from("");
    fs.writeFileSync("../../scratch/dr/parts", JSON.stringify(mtomParts));
    fs.writeFile("../../scratch/dr/false", fileData, err => {
      if (err) {
        console.error(err);
      }
    });
    const fileType = detectFileType(fileData);
    const fileType2 = detectFileType(soapData);
    console.log("File type:", fileType);
    console.log("File type:", fileType2);
  } catch (error) {
    console.error(error);
  }

  return { response: response.data, contentType: response.headers["content-type"] };
}

const quoteRegex = /"/g;
export type MtomContentType = {
  boundary: string;
  start: string;
  type?: string | undefined;
  startInfo?: string | undefined;
};

export interface IMTOMAttachments {
  parts: Array<{
    body: Buffer;
    headers: { [key: string]: string };
  }>;
}

export function parseMtomContentType(contentType: string): MtomContentType {
  const contentTypeParams = contentType.split(";").reduce<Record<string, string>>((acc, param) => {
    const index = param.indexOf("=");
    if (index >= 0) {
      const key = param.substring(0, index).trim().toLowerCase();
      const value = param
        .substring(index + 1)
        .trim()
        .replace(quoteRegex, "");
      acc[key] = value;
    }
    return acc;
  }, {});

  if (!contentTypeParams.boundary) {
    throw new Error("No boundary parameter found in content type.");
  }
  if (!contentTypeParams.start) {
    throw new Error("No start parameter found in content type.");
  }
  return {
    boundary: contentTypeParams.boundary,
    type: contentTypeParams.type,
    start: contentTypeParams.start,
    startInfo: contentTypeParams["start-info"],
  };
}

export async function parseMTOMResp(payload: Buffer, boundary: string): Promise<IMTOMAttachments> {
  return new Promise((resolve, reject) => {
    const resp: IMTOMAttachments = {
      parts: [],
    };
    let headerName = "";
    let headerValue = "";
    let data: Buffer;
    let partIndex = 0;
    const parser = new MultipartParser();

    parser.initWithBoundary(boundary);
    parser.on(
      "data",
      ({
        name,
        buffer,
        start,
        end,
      }: {
        name: string;
        buffer: Buffer;
        start: number;
        end: number;
      }) => {
        switch (name) {
          case "partBegin":
            resp.parts[partIndex] = {
              body: Buffer.from(""),
              headers: {},
            };
            data = Buffer.from("");
            break;
          case "headerField":
            headerName = buffer.slice(start, end).toString();
            break;
          case "headerValue":
            headerValue = buffer.slice(start, end).toString();
            break;
          case "headerEnd":
            //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            resp.parts[partIndex]!.headers[headerName.toLowerCase()] = headerValue;
            break;
          case "partData":
            data = Buffer.concat([data, buffer.slice(start, end)]);
            break;
          case "partEnd":
            //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            resp.parts[partIndex]!.body = data;
            partIndex++;
            break;
        }
      }
    );

    parser.on("end", () => resolve(resp));
    parser.on("error", reject);

    parser.write(payload);
    parser.end();
  });
}
