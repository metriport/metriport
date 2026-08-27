import { BadRequestError, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { QuestRosterType } from "@metriport/shared/interface/external/quest/roster";

const RESPONSE_FILE_PREFIX = "Metriport_";
const RESPONSE_FILE_EXTENSION = ".txt";
const DATE_ID_REGEX = /^\d{12}$/;
const QUEST_PATIENT_RESPONSE_FILE_KEY_REGEX =
  /\/externalId=([\w\d-]+)\/dateId=(\d+)\/[\w\d-]+_\d+_(notifications|backfill)\.tsv/;

export function buildRosterFileName({ rosterType }: { rosterType: QuestRosterType }): string {
  const dateId = buildDayjs().format("YYYYMMDD");
  return `Metriport_${rosterType}_${dateId}.txt`;
}

export function buildRosterFileNameForRoster({
  rosterId,
  rosterType,
}: {
  rosterId: string;
  rosterType: QuestRosterType;
}): string {
  const dateId = buildDayjs().format("YYYYMMDD");
  return `Metriport_${rosterId}_${rosterType}_${dateId}.txt`;
}

/**
 * Parses a file name of the format "Metriport_YYYYM1D1M2D2.txt" and returns an interval ID.
 * E.g. 202501010102 is the interval from Jan 1st to Jan 2nd, 2025
 *
 * If the date ID is prefixed by "MIPE", then it is a historical data file, which is reflected by the
 * rosterType being "backfill". Otherwise, it is a notifications file (which may also have other prefixes like "Sweep").
 */
export function parseResponseFileName(fileName: string): {
  rosterType: QuestRosterType;
  dateId: string;
} {
  if (!fileName.startsWith(RESPONSE_FILE_PREFIX) || !fileName.endsWith(RESPONSE_FILE_EXTENSION)) {
    throw new MetriportError("Invalid file name", undefined, {
      context: "quest.file.file-names",
      fileName,
    });
  }
  let rosterType: QuestRosterType = QuestRosterType.NOTIFICATIONS;
  let dateId = fileName.substring(
    RESPONSE_FILE_PREFIX.length,
    fileName.length - RESPONSE_FILE_EXTENSION.length
  );
  if (dateId.indexOf("_") > 0) {
    const responseType = dateId.substring(0, dateId.indexOf("_"));
    if (responseType === "MIPE") {
      rosterType = QuestRosterType.BACKFILL;
    }
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
    rosterType,
    dateId,
  };
}

export function buildQuestPatientResponseFileName({
  externalId,
  dateId,
  rosterType,
}: {
  externalId: string;
  dateId: string;
  rosterType: QuestRosterType;
}): string {
  return `externalId=${externalId}/dateId=${dateId}/${externalId}_${dateId}_${rosterType}.tsv`;
}

export function parseQuestPatientResponseFileName(fileName: string): {
  externalId: string;
  dateId: string;
  rosterType: QuestRosterType;
} {
  const match = fileName.match(QUEST_PATIENT_RESPONSE_FILE_KEY_REGEX);

  if (!match) {
    throw new BadRequestError("Invalid source document file name", undefined, {
      context: "quest.file.file-names",
      fileName,
    });
  }

  const externalId = match[1];
  const dateId = match[2];
  const rosterType = match[3] as QuestRosterType | undefined;
  if (!externalId || !dateId || !rosterType) {
    throw new BadRequestError("Invalid source document file name", undefined, {
      context: "quest.file.file-names",
      fileName,
      externalId,
      dateId,
    });
  }

  return { externalId, dateId, rosterType };
}

export function buildPatientLabConversionPrefix({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return `quest/cxId=${cxId}/patientId=${patientId}`;
}

export function buildPatientLatestLabConversionFileName({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): string {
  return `${buildPatientLabConversionPrefix({ cxId, patientId })}/latest.json`;
}

export function buildPatientLabConversionFileName({
  cxId,
  patientId,
  dateId,
  rosterType,
}: {
  cxId: string;
  patientId: string;
  dateId: string;
  rosterType: QuestRosterType;
}): string {
  return `${buildPatientLabConversionPrefix({
    cxId,
    patientId,
  })}/dateId=${dateId}/${rosterType}.json`;
}
