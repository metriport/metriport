import { errorToString, MetriportError } from "@metriport/shared";
import { out } from "../../../util/log";
import { createFileKeyHeaders, getS3UtilsInstance } from "../patient-import-shared";

export async function createHeadersFile({
  cxId,
  jobId,
  headers,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  headers: string[];
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(`PatientImport createHeadersFile - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyHeaders(cxId, jobId);
  try {
    const contents = headers.join(",");
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(contents, "utf8"),
      contentType: "text/csv",
    });
  } catch (error) {
    const msg = `Failure while creating headers file @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      key,
      context: "patient-import.createHeadersFile",
    });
  }
}
