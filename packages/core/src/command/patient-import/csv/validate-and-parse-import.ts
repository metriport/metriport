import { errorToString, MetriportError } from "@metriport/shared";
import { PatientImportEntryStatus } from "@metriport/shared/domain/patient/patient-import/types";
import csv from "csv-parser";
import * as stream from "stream";
import { executeAsynchronously } from "../../../util/concurrency";
import { out } from "../../../util/log";
import { ParsedPatient } from "../patient-import";
import { createFileKeyRaw, getS3UtilsInstance } from "../patient-import-shared";
import { createHeadersFile as _createHeadersFile } from "../record/create-headers-file";
import { createPatientRecord } from "../record/create-or-update-patient-record";
import { mapCsvPatientToMetriportPatient } from "./convert-patient";

const MAX_NUMBER_ROWS = 100_000;
const numberOfParallelExecutions = 20;

const columnSeparator = ",";
const commaRegex = new RegExp(/,/g);

/**
 * Validates and parses a CSV file from S3 for bulk patient import.
 * Stores each row in S3, on a dedicated file for further processing..
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param s3BucketName - The S3 bucket name.
 * @returns An array with the row nmbers from the original file, indicating the status of parsing each row.
 */
export async function validateAndParsePatientImportCsvFromS3({
  cxId,
  jobId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  s3BucketName: string;
}): Promise<{ rowNumber: number; status: PatientImportEntryStatus }[]> {
  const { log } = out(
    `PatientImport validateAndParsePatientImportCsvFromS3 - cxId ${cxId} jobId ${jobId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyRaw(cxId, jobId);
  try {
    const csvAsString = await s3Utils.getFileContentsAsString(s3BucketName, key);

    const { patients, headers } = await validateAndParsePatientImportCsv({
      contents: csvAsString,
    });

    const createHeadersFile = async () => {
      await _createHeadersFile({ cxId, jobId, headers, s3BucketName });
    };

    const createPatientRecords = () => {
      return patients.map(p => {
        const base = {
          cxId,
          jobId,
          rowNumber: p.rowNumber,
          rowCsv: p.raw,
          bucketName: s3BucketName,
        };
        if (p.parsed) {
          return createPatientRecord({
            ...base,
            patientCreate: p.parsed,
            status: "waiting",
          });
        } else {
          return createPatientRecord({
            ...base,
            status: "failed",
            reasonForCx: stripCommas(p.error, ";"),
            reasonForDev: "400 - validation error",
          });
        }
      });
    };

    await executeAsynchronously(
      [createHeadersFile(), ...createPatientRecords()],
      async promise => {
        await promise;
      },
      {
        numberOfParallelExecutions,
      }
    );

    // TODO 2330 split these in the `createPatientRecords` function
    return patients.map(p => ({
      rowNumber: p.rowNumber,
      status: p.parsed ? "processing" : "failed",
    }));
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

/**
 * Validates and parses a CSV string containing patient data for bulk import.
 *
 * NOTE: when parsing columns, csv-parser populates them in lower-case.
 *
 * @param csvAsString - The CSV file contents as a string.
 * @returns An object containing the parsed patients, valid rows, invalid rows, and headers.
 */
export async function validateAndParsePatientImportCsv({
  contents: csvAsString,
}: {
  contents: string;
}): Promise<{
  headers: string[];
  patients: ParsedPatient[];
}> {
  let numberOfRows = 0;
  const promise = new Promise<{
    headers: string[];
    patients: ParsedPatient[];
  }>(function (resolve, reject) {
    const patients: ParsedPatient[] = [];
    const headers: string[] = [];
    const s = new stream.Readable();
    s.push(csvAsString);
    // indicates end-of-file basically - the end of the stream
    s.push(null);
    s.pipe(
      csv({
        mapHeaders: ({ header }: { header: string }) => {
          return header.replace(/[!@#$%^&*()+=\[\]\\';,./{}|":<>?~_\s]/gi, ""); //eslint-disable-line
        },
      })
    )
      .on("headers", async (parsedHeaders: string[]) => {
        headers.push(...parsedHeaders);
      })
      .on("data", async data => {
        try {
          if (++numberOfRows > MAX_NUMBER_ROWS) {
            throw new MetriportError(`CSV has more rows than max (${MAX_NUMBER_ROWS})`);
          }
          const parsedPatient = csvRecordToParsedPatient(data, numberOfRows);
          patients.push(parsedPatient);
        } catch (error) {
          reject(error);
        }
      })
      .on("end", async () => {
        return resolve({ patients, headers });
      })
      .on("error", reject);
  });
  return await promise;
}

export function csvRecordToParsedPatient(
  data: Record<string, string>,
  rowNumber: number
): ParsedPatient {
  const raw = Object.values(data) as string[];
  const rawNormalized = raw.map(r => (r.includes(columnSeparator) ? `"${r}"` : r));
  const result = mapCsvPatientToMetriportPatient(data);
  const baseParsedPatient = { rowNumber, raw: rawNormalized.join(",") };
  if (Array.isArray(result)) {
    return { ...baseParsedPatient, error: result.map(e => e.error).join("; ") };
  } else {
    return { ...baseParsedPatient, parsed: result };
  }
}

function stripCommas(input: string, replacement = "") {
  return input.replace(commaRegex, replacement);
}
