import {
  Document,
  CommonWell,
  CommonWellAPI,
  APIMode,
  PurposeOfUse,
} from "@metriport/commonwell-sdk";
import * as Sentry from "@sentry/serverless";
import * as stream from "stream";
import { PassThrough } from "stream";
import AWS from "aws-sdk";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const cwOrgCertificate = getEnvOrFail("CW_ORG_CERTIFICATE");
const cwOrgKey = getEnvOrFail("CW_ORG_PRIVATE_KEY");
const envType = getEnvOrFail("ENV_TYPE");

const apiMode = envType === "production" ? APIMode.production : APIMode.integration;
export const OID_PREFIX = "urn:oid:";

const s3client = new AWS.S3({
  signatureVersion: "v4",
});

type DocumentWithOriginalIdAndContent = Document & {
  originalId: string;
  content: { location: string };
};

export type ContentMimeType = Pick<Document["content"], "mimeType">;

export type S3Info = {
  docId: string;
  fileExists: boolean;
  fileSize: number | undefined;
  fileName: string;
  fileLocation: string;
};

export const handler = Sentry.AWSLambda.wrapHandler(
  async (req: {
    document: DocumentWithOriginalIdAndContent;
    fileInfo: S3Info;
    orgName: string;
    orgOid: string;
    facilityNPI: string;
  }) => {
    const { document, fileInfo, orgName, orgOid, facilityNPI } = req;
    console.log(`Running with document: ${document.id}`);

    const { writeStream, promise } = uploadStream(
      fileInfo.fileName,
      fileInfo.fileLocation,
      document.content.mimeType
    );

    await downloadDocumentFromCW({
      orgName,
      orgOid,
      facilityNPI,
      location: document.content.location,
      stream: writeStream,
    });

    const uploadResult = await promise;

    console.log(`Uploaded ${document.id} to ${uploadResult.Location}`);

    const downloadedDocument = await downloadDocumentFromS3({ fileName: uploadResult.Key });

    const { size } = await getFileInfoFromS3(uploadResult.Key, uploadResult.Bucket);

    const originalXml = {
      bucket: uploadResult.Bucket,
      key: uploadResult.Key,
      location: uploadResult.Location,
      size,
      isNew: true,
    };

    if (downloadedDocument.data && downloadedDocument.contentType === "application/xml") {
      const containsB64 = downloadedDocument.data.includes("nonXMLBody");

      if (containsB64) {
        const { newXML, b64 } = removeAndReturnB64FromXML(downloadedDocument.data);

        // for testing
        const newFileName = fileInfo.fileName.concat("-inside.pdf");

        const b64Buff = Buffer.from(b64, "base64");

        const b64Upload = await s3client
          .upload({
            Bucket: bucketName,
            Key: newFileName,
            Body: b64Buff,
            ContentType: "application/pdf",
          })
          .promise();

        await s3client
          .putObject({
            Bucket: bucketName,
            Key: fileInfo.fileName,
            Body: newXML,
            ContentType: "application/xml",
          })
          .promise();

        const b64FileInfo = await getFileInfoFromS3(b64Upload.Key, b64Upload.Bucket);
        const newXmlFileInfo = await getFileInfoFromS3(uploadResult.Key, uploadResult.Bucket);

        originalXml.size = newXmlFileInfo.size;

        return [
          originalXml,
          {
            bucket: b64Upload.Bucket,
            key: b64Upload.Key,
            location: b64Upload.Location,
            size: b64FileInfo.size,
            isNew: true,
          },
        ];
      } else {
        return [originalXml];
      }
    } else {
      return [originalXml];
    }
  }
);

function uploadStream(s3FileName: string, s3FileLocation: string, contentType?: string) {
  const pass = new PassThrough();
  return {
    writeStream: pass,
    promise: s3client
      .upload({
        Bucket: s3FileLocation,
        Key: s3FileName,
        Body: pass,
        ContentType: contentType ? contentType : "text/xml",
      })
      .promise(),
  };
}

export function makeCommonWellAPI(orgName: string, orgOID: string): CommonWellAPI {
  return new CommonWell(cwOrgCertificate, cwOrgKey, orgName, orgOID, apiMode);
}

async function downloadDocumentFromCW({
  orgName,
  orgOid,
  facilityNPI,
  location,
  stream,
}: {
  orgName: string;
  orgOid: string;
  facilityNPI: string;
  location: string;
  stream: stream.Writable;
}): Promise<void> {
  const commonWell = makeCommonWellAPI(orgName, oid(orgOid));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  try {
    await commonWell.retrieveDocument(queryMeta, location, stream);
  } catch (err) {
    capture.error(err, {
      extra: { context: "documentDownloadLambdaDownloadDocumentFromCW", lambdaName, err },
    });
  }
}

function oid(id: string): string {
  return `${OID_PREFIX}${id}`;
}

export interface RequestMetadata {
  role: string;
  subjectId: string;
  purposeOfUse: PurposeOfUse;
  npi?: string;
  payloadHash?: string;
}

export type OrgRequestMetadataCreate = Omit<
  RequestMetadata,
  "npi" | "role" | "purposeOfUse" | "subjectId"
> &
  Required<Pick<RequestMetadata, "npi">> &
  Partial<Pick<RequestMetadata, "role" | "purposeOfUse">>;

export function organizationQueryMeta(
  orgName: string,
  meta: OrgRequestMetadataCreate
): RequestMetadata {
  const base = baseQueryMeta(orgName);
  return {
    subjectId: base.subjectId,
    role: meta.role ?? base.role,
    purposeOfUse: meta.purposeOfUse ?? base.purposeOfUse,
    npi: meta.npi,
  };
}

const baseQueryMeta = (orgName: string) => ({
  purposeOfUse: PurposeOfUse.TREATMENT,
  role: "ict",
  subjectId: `${orgName} System User`,
});

const downloadDocumentFromS3 = async ({
  fileName,
}: {
  fileName: string;
}): Promise<{ data: string | undefined; contentType: string | undefined }> => {
  const file = await s3client
    .getObject({
      Bucket: bucketName,
      Key: fileName,
    })
    .promise();

  const data = file.Body?.toString("utf-8");

  return {
    data,
    contentType: file.ContentType,
  };
};

export async function getFileInfoFromS3(
  key: string,
  bucket: string
): Promise<{ exists: true; size: number } | { exists: false; size?: never }> {
  try {
    const head = await s3client
      .headObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
    return { exists: true, size: head.ContentLength ?? 0 };
  } catch (err) {
    return { exists: false };
  }
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
