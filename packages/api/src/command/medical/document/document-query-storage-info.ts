import { DocumentReferenceContent } from "@medplum/fhirtypes";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "../../../shared/config";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3BucketName = Config.getMedicalDocumentsBucketName();

export type S3Info = {
  docId: string;
  fileExists: boolean;
  fileSize: number | undefined;
  fileName: string;
  fileLocation: string;
  fileContentType: string | undefined;
};

export type SimplerFile = {
  fileName: string;
  fileLocation: string;
  fileContentType: string | undefined;
};

export type SimpleFile = {
  docId: string;
} & SimplerFile;

export function docRefContentToFileFunction(
  content: DocumentReferenceContent
): SimplerFile | undefined {
  const attachment = content.attachment;
  if (!attachment) return undefined;
  const fileLocation = s3BucketName;
  const fileContentType = attachment.contentType;
  const fileName = attachment.title;
  if (!fileName) return undefined;
  return { fileName, fileLocation, fileContentType };
}

export function getUrl(s3FileName: string, s3FileLocation: string) {
  return s3Utils.getSignedUrl({
    bucketName: s3FileLocation,
    fileName: s3FileName,
  });
}
