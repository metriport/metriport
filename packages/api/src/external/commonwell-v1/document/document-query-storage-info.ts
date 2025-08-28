import { createDocumentFilePath } from "@metriport/core/domain/document/filename";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { S3Info, SimpleFile } from "../../../command/medical/document/document-query-storage-info";
import { DocumentWithMetriportId } from "../../../external/commonwell-v1/document/shared";
import { Config } from "../../../shared/config";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3BucketName = Config.getMedicalDocumentsBucketName();

function getDocToFileFunction(patient: Pick<Patient, "cxId" | "id">) {
  // TODO convert the input from CW Document to a Metriport shape
  return async ({
    id,
    contentType,
  }: {
    id: string;
    contentType: string | undefined;
  }): Promise<SimpleFile> => {
    const fileName = createDocumentFilePath(patient.cxId, patient.id, id, contentType);
    return {
      docId: id,
      fileName,
      fileLocation: s3BucketName,
      fileContentType: contentType,
    };
  };
}

// TODO convert this to: 1. list files on patient's folder on S3; 2. match to docs and retrieve info
export async function getS3Info(
  documents: DocumentWithMetriportId[],
  patient: Pick<Patient, "cxId" | "id">
): Promise<S3Info[]> {
  const { log } = out(`getS3Info - patient ${patient.id}`);

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
