import {
  CommonWell,
  CommonWellAPI,
  APIMode,
  CommonwellError,
  organizationQueryMeta,
} from "@metriport/commonwell-sdk";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import * as Sentry from "@sentry/serverless";
import * as stream from "stream";
import { PassThrough } from "stream";
import AWS from "aws-sdk";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail } from "./shared/env";
import { S3Utils } from "./shared/s3";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const cwOrgCertificateSecret = getEnvOrFail("CW_ORG_CERTIFICATE");
const cwOrgPrivateKeySecret = getEnvOrFail("CW_ORG_PRIVATE_KEY");
const envType = getEnvOrFail("ENV_TYPE");

const apiMode = envType === "production" ? APIMode.production : APIMode.integration;
export const OID_PREFIX = "urn:oid:";

const s3client = new AWS.S3({
  signatureVersion: "v4",
});

const s3Utils = new S3Utils(region);

type Document = {
  id: string;
  mimeType: string;
  location: string;
};

export type S3Info = {
  docId: string;
  fileExists: boolean;
  fileSize: number | undefined;
  fileName: string;
  fileLocation: string;
};

export const handler = Sentry.AWSLambda.wrapHandler(
  async (req: {
    document: Document;
    fileInfo: S3Info;
    orgName: string;
    orgOid: string;
    npi: string;
    cxId: string;
  }): Promise<{
    bucket: string;
    key: string;
    location: string;
    contentType: string | undefined;
    size: number | undefined;
    isNew: boolean;
  }> => {
    const { document, fileInfo, orgName, orgOid, npi, cxId } = req;

    const cwOrgCertificate: string = (await getSecret(cwOrgCertificateSecret)) as string;
    if (!cwOrgCertificate) {
      throw new Error(`Config error - CW_ORG_CERTIFICATE doesn't exist`);
    }

    const cwOrgPrivateKey: string = (await getSecret(cwOrgPrivateKeySecret)) as string;
    if (!cwOrgPrivateKey) {
      throw new Error(`Config error - CW_ORG_PRIVATE_KEY doesn't exist`);
    }

    const pass = new PassThrough();

    const downloadedDocument = await streamToString(pass);

    await downloadDocumentFromCW({
      orgCertificate: cwOrgCertificate,
      orgPrivateKey: cwOrgPrivateKey,
      orgName,
      orgOid,
      npi,
      location: document.location,
      stream: pass,
    });

    const uploadResult = await uploadDocumentToS3(
      downloadedDocument,
      fileInfo.fileName,
      fileInfo.fileLocation,
      document.mimeType
    );

    console.log(`Uploaded ${document.id} to ${uploadResult.Location}`);

    const { size, contentType } = await s3Utils.getFileInfoFromS3(
      uploadResult.Key,
      uploadResult.Bucket
    );

    const originalXml = {
      bucket: uploadResult.Bucket,
      key: uploadResult.Key,
      location: uploadResult.Location,
      size,
      contentType,
      isNew: true,
    };

    if (downloadedDocument && document.mimeType === "application/xml") {
      const containsB64 = downloadedDocument.includes("nonXMLBody");

      if (containsB64) {
        const { newXML, b64 } = removeAndReturnB64FromXML(downloadedDocument);

        const newFileName = fileInfo.fileName.split(".")[0].concat(".pdf");

        const b64Buff = Buffer.from(b64, "base64");

        const [b64Upload] = await Promise.all([
          await s3client
            .upload({
              Bucket: bucketName,
              Key: newFileName,
              Body: b64Buff,
              ContentType: "application/pdf",
            })
            .promise(),
          await s3client
            .putObject({
              Bucket: bucketName,
              Key: fileInfo.fileName,
              Body: newXML,
              ContentType: "application/xml",
            })
            .promise(),
        ]);

        const [b64FileInfo, newXmlFileInfo] = await Promise.all([
          await s3Utils.getFileInfoFromS3(b64Upload.Key, b64Upload.Bucket),
          await s3Utils.getFileInfoFromS3(uploadResult.Key, uploadResult.Bucket),
        ]);

        originalXml.size = newXmlFileInfo.size;

        const msg = `Multiple files created due to b64 in xml`;

        capture.message(msg, {
          extra: {
            context: `documentDownloader.extractB64FromXML`,
            b64FileName: b64Upload.Key,
            xmlFileName: uploadResult.Key,
            orgName,
            cxId,
          },
        });

        return {
          bucket: b64Upload.Bucket,
          key: b64Upload.Key,
          location: b64Upload.Location,
          size: b64FileInfo.size,
          contentType: b64FileInfo.contentType,
          isNew: true,
        };
      } else {
        return originalXml;
      }
    } else {
      return originalXml;
    }
  }
);

async function uploadDocumentToS3(
  document: string,
  s3FileName: string,
  s3FileLocation: string,
  contentType?: string
) {
  const uploadedResult = await s3client
    .upload({
      Bucket: s3FileLocation,
      Key: s3FileName,
      Body: document,
      ContentType: contentType ? contentType : "text/xml",
    })
    .promise();
  return uploadedResult;
}

export function makeCommonWellAPI(
  cwOrgCertificate: string,
  cwOrgKey: string,
  orgName: string,
  orgOID: string
): CommonWellAPI {
  return new CommonWell(cwOrgCertificate, cwOrgKey, orgName, orgOID, apiMode);
}

async function downloadDocumentFromCW({
  orgCertificate,
  orgPrivateKey,
  orgName,
  orgOid,
  npi,
  location,
  stream,
}: {
  orgCertificate: string;
  orgPrivateKey: string;
  orgName: string;
  orgOid: string;
  npi: string;
  location: string;
  stream: stream.Writable;
}): Promise<void> {
  const commonWell = makeCommonWellAPI(orgCertificate, orgPrivateKey, orgName, oid(orgOid));
  const queryMeta = organizationQueryMeta(orgName, { npi: npi });

  try {
    await commonWell.retrieveDocument(queryMeta, location, stream);
  } catch (err) {
    const additionalInfo = {
      cwReferenceHeader: commonWell.lastReferenceHeader,
      documentLocation: location,
    };

    capture.error(err, {
      extra: {
        context: "documentDownloadLambdaDownloadDocumentFromCW",
        lambdaName,
        err,
        additionalInfo,
      },
    });

    if (err instanceof CommonwellError && err.cause?.response?.status === 404) {
      throw new Error("CW - Document not found", err);
    }
    throw new Error(`CW - Error downloading document`);
  }
}

function oid(id: string): string {
  return `${OID_PREFIX}${id}`;
}

export async function getFileInfoFromS3(
  key: string,
  bucket: string
): Promise<
  | { exists: true; size: number; contentType: string }
  | { exists: false; size?: never; contentType?: never }
> {
  try {
    const head = await s3client
      .headObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
    return { exists: true, size: head.ContentLength ?? 0, contentType: head.ContentType ?? "" };
  } catch (err) {
    return { exists: false };
  }
}

function streamToString(stream: stream.Readable): Promise<string> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on("data", chunk => chunks.push(Buffer.from(chunk)));
    stream.on("error", err => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function removeAndReturnB64FromXML(htmlString: string): { newXML: string; b64: string } {
  const openingTag = "<text";
  const closingTag = "</text>";
  const startIndex = htmlString.indexOf(openingTag);
  const endIndex = htmlString.lastIndexOf(closingTag);
  const textTag = htmlString.substring(startIndex, endIndex + closingTag.length);

  const newXML = htmlString.replace(textTag, "");
  const b64 = removeHTMLTags(textTag);

  return {
    newXML,
    b64,
  };
}

function removeHTMLTags(htmlString: string): string {
  return htmlString.replace(/(<([^>]+)>)/gi, "");
}
