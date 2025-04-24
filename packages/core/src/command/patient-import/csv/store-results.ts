import { errorToString, MetriportError } from "@metriport/shared";
import { PatientImportEntryStatus } from "@metriport/shared/domain/patient/patient-import/types";
import { out } from "../../../util/log";
import {
  createFileKeyHeaders,
  createFileKeyInvalid,
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
 * It also stores the invalid entries in a separate file.
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
  const keyResult = createFileKeyResults(cxId, jobId);
  const keyInvalid = createFileKeyInvalid(cxId, jobId);
  try {
    const headersFileKey = createFileKeyHeaders(cxId, jobId);
    const headers = await s3Utils.getFileContentsAsString(bucketName, headersFileKey);
    const headersWithResultColumns = headers + ",metriportId,status,reason";
    const sortedEntries = resultEntries.sort((a, b) => a.rowNumber - b.rowNumber);
    const resultEntriesAsCsv = sortedEntries.map(entryToCsv).join("\n");
    const invalidEntriesAsCsv = sortedEntries
      .filter(e => e.status === "failed")
      .map(entryToCsv)
      .join("\n");
    const resultCsvContents = [headersWithResultColumns, resultEntriesAsCsv].join("\n");
    const invalidCsvContents = [headersWithResultColumns, invalidEntriesAsCsv].join("\n");

    await Promise.all([
      s3Utils.uploadFile({
        bucket: bucketName,
        key: keyResult,
        file: Buffer.from(resultCsvContents, "utf8"),
        contentType: "text/csv",
      }),
      s3Utils.uploadFile({
        bucket: bucketName,
        key: keyInvalid,
        file: Buffer.from(invalidCsvContents, "utf8"),
        contentType: "text/csv",
      }),
    ]);
  } catch (error) {
    const msg = `Failure storing results of bulk patient import @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      keyResult,
      keyInvalidEntries: keyInvalid,
      context: "patient-import.storeResults",
    });
  }
}

function entryToCsv(e: ResultEntry): string {
  return `${e.rowCsv},${e.patientId ?? ""},${e.status},${e.reason ?? ""}`;
}
