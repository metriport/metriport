import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";

const RESPONSE_FILE_PREFIX = "Metriport_";
const RESPONSE_FILE_EXTENSION = ".txt";
const DATE_ID_REGEX = /^\d{12}$/;

export function buildRosterFileName() {
  const dateId = buildDayjs().format("YYYYMMDD");
  return `Metriport_roster_${dateId}.txt`;
}

/**
 * Parses a file name of the format "Metriport_YYYYM1D1M2D2.txt" and returns an interval ID.
 * E.g. 202501010102 is the interval from Jan 1st to Jan 2nd, 2025
 */
export function parseResponseFileName(fileName: string): { dateId: string } {
  if (!fileName.startsWith(RESPONSE_FILE_PREFIX) || !fileName.endsWith(RESPONSE_FILE_EXTENSION)) {
    throw new MetriportError("Invalid file name", undefined, {
      context: "quest.file.file-names",
      fileName,
    });
  }
  const dateId = fileName.substring(
    RESPONSE_FILE_PREFIX.length,
    fileName.length - RESPONSE_FILE_EXTENSION.length
  );

  if (!DATE_ID_REGEX.test(dateId)) {
    throw new MetriportError("Invalid date ID in file name", undefined, {
      context: "quest.file.file-names",
      fileName,
      dateId,
    });
  }

  return {
    dateId,
  };
}

export function buildSourceDocumentFileName({
  patientId,
  dateId,
}: {
  patientId: string;
  dateId: string;
}): string {
  return `ptId=${patientId}/dateId=${dateId}/${patientId}_${dateId}_source.tsv`;
}

export function buildPatientLabConversionPrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return `quest/cxId=${cxId}/patientId=${patientId}/dateId=`;
}

export function buildLatestConversionFileName(cxId: string, patientId: string): string {
  return `quest/cxId=${cxId}/patientId=${patientId}/latest.json`;
}

export function buildLabConversionFileNameForDate({
  cxId,
  patientId,
  dateId,
}: {
  cxId: string;
  patientId: string;
  dateId: string;
}): string {
  return `quest/cxId=${cxId}/patientId=${patientId}/dateId=${dateId}/conversion.json`;
}
