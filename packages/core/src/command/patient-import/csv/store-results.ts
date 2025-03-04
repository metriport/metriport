import { errorToString, MetriportError } from "@metriport/shared";
import { PatientImportEntryStatus } from "@metriport/shared/domain/patient/patient-import/types";
import { out } from "../../../util/log";
import {
  createFileKeyHeaders,
  createFileKeyResults,
  getS3UtilsInstance,
} from "../patient-import-shared";

export type StoreResultCmd = {
  cxId: string;
  jobId: string;
  resultEntries: ResultEntry[];
  bucketName: string;
};

export type ResultEntry = {
  rowNumber: number;
  rowCsv: string;
  status: PatientImportEntryStatus;
  patientId: string | undefined;
  reason: string | undefined;
};

/**
 * Stores the results of a bulk patient import in S3.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param s3BucketName - The S3 bucket name.
 * @returns An array with the row nmbers from the original file that were successfully parsed.
 */
export async function storeResults({
  cxId,
  jobId,
  resultEntries,
  bucketName,
}: StoreResultCmd): Promise<void> {
  const { log } = out(`PatientImport storeResults - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyResults(cxId, jobId);
  try {
    const headersFileKey = createFileKeyHeaders(cxId, jobId);
    const headers = await s3Utils.getFileContentsAsString(bucketName, headersFileKey);
    const headersWithResultColumns = headers + ",status,patientId,reason";
    const sortedEntries = resultEntries.sort((a, b) => a.rowNumber - b.rowNumber);
    const entriesAsCsv = sortedEntries
      .map(e => `${e.rowCsv},${e.status},${e.patientId ?? ""},${e.reason ?? ""}`)
      .join("\n");
    const csvContents = [headersWithResultColumns, entriesAsCsv].join("\n");

    await s3Utils.uploadFile({
      bucket: bucketName,
      key,
      file: Buffer.from(csvContents, "utf8"),
      contentType: "text/csv",
    });
  } catch (error) {
    const msg = `Failure validating and parsing import @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      key,
      context: "patient-import.validateAndParsePatientImportCsvFromS3",
    });
  }
}
