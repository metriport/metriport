import { DocumentReferenceContent } from "@medplum/fhirtypes";
import { Document } from "@metriport/commonwell-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { capture } from "@metriport/core/util/notifications";
import { DocumentWithMetriportId } from "../../../external/commonwell/document/shared";
import { Config } from "../../../shared/config";
import { createS3FileName } from "../../../shared/external";
import { Util } from "../../../shared/util";

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
type SimpleFile = {
  docId: string;
} & SimplerFile;

export function getDocToFileFunction(patient: Pick<Patient, "cxId" | "id">) {
  // TODO convert the input from CW Document to a Metriport shape
  return async (doc: Document): Promise<SimpleFile> => {
    const docName = doc.id;
    const fileName = createS3FileName(patient.cxId, patient.id, docName);
    return {
      docId: doc.id,
      fileName,
      fileLocation: s3BucketName,
      fileContentType: doc.content?.mimeType,
    };
  };
}
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

// TODO convert this to: 1. list files on patient's folder on S3; 2. match to docs and retrieve info
export async function getS3Info(
  documents: DocumentWithMetriportId[],
  patient: Pick<Patient, "cxId" | "id">
): Promise<S3Info[]> {
  const { log } = Util.out(`getS3Info - patient ${patient.id}`);

  const errors: { error: unknown; message: string; docId: string }[] = [];
  const docToFile = getDocToFileFunction(patient);
  const s3Info = await Promise.allSettled(
    documents
      .map(d => docToFile(d))
      .map(async (filePromise: Promise<SimpleFile>): Promise<S3Info> => {
        const file = await filePromise;
        try {
          const {
            exists: fileExists,
            size: fileSize,
            contentType: fileContentType,
          } = await s3Utils.getFileInfoFromS3(file.fileName, file.fileLocation);
          return {
            docId: file.docId,
            fileExists,
            fileSize,
            fileContentType,
            fileName: file.fileName,
            fileLocation: file.fileLocation,
          };
        } catch (error) {
          errors.push({
            error,
            message: String(error),
            docId: file.docId,
          });
          throw error;
        }
      })
  );
  if (errors.length > 0) {
    const msg = `Errors getting info from S3`;
    const extra = { errors, patientId: patient.id };
    log(msg, extra);
    capture.error(msg, { extra });
  }
  const successful: S3Info[] = s3Info.flatMap(ref =>
    ref.status === "fulfilled" && ref.value ? ref.value : []
  );
  return successful;
}

export function getUrl(s3FileName: string, s3FileLocation: string) {
  return s3Utils.s3.getSignedUrl("getObject", {
    Bucket: s3FileLocation,
    Key: s3FileName,
  });
}
