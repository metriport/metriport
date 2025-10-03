import { BadRequestError, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";

const RESPONSE_FILE_PREFIX = "Metriport_";
const RESPONSE_FILE_EXTENSION = ".txt";
const DATE_ID_REGEX = /^\d{12}$/;
const SOURCE_DOCUMENT_KEY_REGEX = /\/externalId=([\w\d-]+)\/dateId=(\d+)\//;

export function buildRosterFileName({ notifications }: { notifications?: boolean | undefined }) {
  const dateId = buildDayjs().format("YYYYMMDD");
  return `Metriport_${notifications ? "notifications" : "backfill"}_${dateId}.txt`;
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
  let dateId = fileName.substring(
    RESPONSE_FILE_PREFIX.length,
    fileName.length - RESPONSE_FILE_EXTENSION.length
  );
  if (dateId.indexOf("_") > 0) {
    dateId = dateId.substring(dateId.indexOf("_") + 1);
  }

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
  externalId,
  dateId,
}: {
  externalId: string;
  dateId: string;
}): string {
  return `externalId=${externalId}/dateId=${dateId}/${externalId}_${dateId}_source.tsv`;
}

export function parseSourceDocumentFileName(fileName: string): {
  externalId: string;
  dateId: string;
} {
  const match = fileName.match(SOURCE_DOCUMENT_KEY_REGEX);

  if (!match) {
    throw new BadRequestError("Invalid source document file name", undefined, {
      context: "quest.file.file-names",
      fileName,
    });
  }

  const externalId = match[1];
  const dateId = match[2];
  if (!externalId || !dateId) {
    throw new BadRequestError("Invalid source document file name", undefined, {
      context: "quest.file.file-names",
      fileName,
      externalId,
      dateId,
    });
  }

  return { externalId, dateId };
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
