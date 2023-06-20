import { Document } from "@metriport/commonwell-sdk";
import { PassThrough } from "stream";
import { makeS3Client } from "../../../external/aws/s3";
import { Patient } from "../../../models/medical/patient";
import { Config } from "../../../shared/config";
import { createS3FileName, getDocumentPrimaryId } from "../../../shared/external";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";

const s3Client = makeS3Client();
const s3BucketName = Config.getMedicalDocumentsBucketName();

export type S3Info = {
  fhirDocId: string;
  docId: string;
  fileExists: boolean;
  fileSize: number | undefined;
  fileName: string;
  fileLocation: string;
};

type SimpleFile = {
  fhirDocId: string;
  docId: string;
  fileName: string;
  fileLocation: string;
};

export function docToFile(patient: Pick<Patient, "cxId" | "id">) {
  // TODO convert the input from CW Document to a Metriport shape
  return (doc: Document): SimpleFile => {
    const fhirDocId = getDocumentPrimaryId(doc);
    const fileName = createS3FileName(patient.cxId, patient.id, fhirDocId);
    return { fhirDocId, docId: doc.id, fileName, fileLocation: s3BucketName };
  };
}

// TODO convert this to: 1. list files on patient's folder on S3; 2. match to docs and retrieve info
export async function getS3Info(
  documents: Document[],
  patient: Pick<Patient, "cxId" | "id">
): Promise<S3Info[]> {
  const { log } = Util.out(`getS3Info - patient ${patient.id}`);

  const errors: { error: unknown; message: string; docId: string; fhirDocId: string }[] = [];
  const s3Info = await Promise.allSettled(
    documents.map(docToFile(patient)).map(async (doc): Promise<S3Info> => {
      try {
        const { exists: fileExists, size: fileSize } = await getFileInfoFromS3(
          doc.fileName,
          doc.fileLocation
        );
        return {
          fhirDocId: doc.fhirDocId,
          docId: doc.docId,
          fileExists,
          fileSize,
          fileName: doc.fileName,
          fileLocation: doc.fileLocation,
        };
      } catch (error) {
        errors.push({
          error,
          message: String(error),
          docId: doc.docId,
          fhirDocId: doc.fhirDocId,
        });
        throw error;
      }
    })
  );
  if (errors.length > 0) {
    const msg = `Errors getting info from S3`;
    const extra = { errors, patientId: patient.id };
    log(msg, extra);
    capture.message(msg, { extra });
  }
  const successful: S3Info[] = s3Info.flatMap(ref =>
    ref.status === "fulfilled" && ref.value ? ref.value : []
  );
  return successful;
}

export function uploadStream(s3FileName: string, s3FileLocation: string, contentType?: string) {
  const pass = new PassThrough();
  return {
    writeStream: pass,
    promise: s3Client
      .upload({
        Bucket: s3FileLocation,
        Key: s3FileName,
        Body: pass,
        ContentType: contentType ? contentType : "text/xml",
      })
      .promise(),
  };
}

export async function getFileInfoFromS3(
  key: string,
  bucket: string
): Promise<{ exists: true; size: number } | { exists: false; size?: never }> {
  try {
    const head = await s3Client
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

export function getUrl(s3FileName: string, s3FileLocation: string) {
  return s3Client.getSignedUrl("getObject", {
    Bucket: s3FileLocation,
    Key: s3FileName,
  });
}
