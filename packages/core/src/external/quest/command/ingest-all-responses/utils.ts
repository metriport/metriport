import { errorToString } from "@metriport/shared";
import {
  questRosterMetadataSchema,
  QuestRosterType,
} from "@metriport/shared/interface/external/quest/roster";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import { getCxsWithQuestFeatureFlag } from "../../../../command/feature-flags/domain-ffs";
import { RosterResponse } from "../../../../command/roster/api/api-shared";
import { getRosters } from "../../../../command/roster/api/get-rosters";
import { updateRoster } from "../../../../command/roster/api/update-roster";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { QuestResponseFile } from "../../client";
import { QUEST_PATIENT_RESPONSE_FILE_HEADER } from "../../file/constants";
import { parseResponseFileName } from "../../file/file-names";
import { parseResponseFile } from "../../file/file-parser";
import { ResponseDetail } from "../../schema/response";
import { IncomingData } from "../../schema/shared";

const MAX_PARALLEL_ROSTER_UPDATES = 10;

type IncomingRow = IncomingData<ResponseDetail>;
type PatientToIncomingRowMap = Map<string, IncomingRow[]>;

export type QuestPatientResponseFile = {
  externalId: string;
  dateId: string;
  rosterType: QuestRosterType;
  fileContent: Buffer;
};

/**
 * Given an array of Quest response files, splits all of them into patient-specific response files
 * and returns an array of in-memory files that can be uploaded to S3.
 */
export function splitResponseFilesIntoQuestPatientResponseFiles(
  responseFiles: QuestResponseFile[]
): QuestPatientResponseFile[] {
  const { log } = out("quest.splitResponseFilesIntoQuestPatientResponseFiles");
  log(`Generating response files for ${responseFiles.length} response file(s)`);
  const allPatientResponseFiles: QuestPatientResponseFile[] = [];
  const errors: unknown[] = [];
  for (const responseFile of responseFiles) {
    try {
      const patientResponseFiles = splitResponseFileIntoQuestPatientResponseFiles(responseFile);
      allPatientResponseFiles.push(...patientResponseFiles);
    } catch (error) {
      errors.push(error);
      continue;
    }
  }
  if (errors.length > 0) {
    const msg = `Failed to split some Quest response files`;
    const errorString = errors.map(error => errorToString(error)).join(", ");
    log(`${msg}. Causes: ${errorString}`);
    capture.message(msg, {
      extra: {
        errorsCount: errors.length,
        errors: errorString,
        context: "quest.ingest-all-responses",
      },
      level: "warning",
    });
  }
  return allPatientResponseFiles;
}

/**
 * Split a Quest response file into separate source documents for each patient.
 */
export function splitResponseFileIntoQuestPatientResponseFiles(
  responseFile: QuestResponseFile
): QuestPatientResponseFile[] {
  const rows = parseResponseFile(responseFile.fileContent);
  const rowsGroupedByExternalId = groupRowsByExternalId(rows);
  const parsed = parseResponseFileName(responseFile.fileName);
  if (!parsed) return [];
  const { dateId, rosterType } = parsed;
  const patientResponseFiles: QuestPatientResponseFile[] = [];
  for (const [externalId, patientRows] of rowsGroupedByExternalId.entries()) {
    const fileContent = convertPatientRowsToFileContent(patientRows);
    patientResponseFiles.push({ externalId, dateId, rosterType, fileContent });
  }
  return patientResponseFiles;
}

/**
 * Groups a list of incoming rows by the external ID column.
 */
function groupRowsByExternalId(rows: IncomingRow[]): PatientToIncomingRowMap {
  const externalIdRow: PatientToIncomingRowMap = new Map();
  for (const row of rows) {
    const externalId = row.data.externalId;
    if (!externalId) continue;
    const existingRows = externalIdRow.get(externalId);
    if (existingRows) {
      existingRows.push(row);
    } else {
      externalIdRow.set(externalId, [row]);
    }
  }
  return externalIdRow;
}

/**
 * Creates a response file from a list of incoming rows.
 */
function convertPatientRowsToFileContent(patientRows: IncomingRow[]): Buffer {
  const fileContentAsString = patientRows.map(row => row.source).join("\n");
  const fileContent = Buffer.from(
    QUEST_PATIENT_RESPONSE_FILE_HEADER + fileContentAsString,
    "ascii"
  );
  return fileContent;
}

/**
 * Updates the rosters across all customers that have the Quest feature flag enabled.
 * This maps response files to rosters so that we can know if a roster has a response file when
 * grabbing a patient NQ status.
 */
export async function updateRosters({
  rosterType,
  dateId,
}: {
  rosterType: QuestRosterType;
  dateId: string;
}): Promise<void> {
  const { log } = out("quest.updateRosters");
  const cxIds = await getCxsWithQuestFeatureFlag();
  const rosters: RosterResponse[] = [];
  const getRostersErrors: unknown[] = [];
  await executeAsynchronously(
    cxIds,
    async cxId => {
      try {
        const cxRosters = await getRosters({
          cxId,
          source: questSource,
          type: rosterType,
          status: "closed",
        });
        rosters.push(...cxRosters);
      } catch (error) {
        getRostersErrors.push(error);
      }
    },
    { numberOfParallelExecutions: MAX_PARALLEL_ROSTER_UPDATES }
  );
  if (getRostersErrors.length > 0) {
    const msg = `Failed to get some Quest rosters while ingesting all responses`;
    const errorString = getRostersErrors.map(error => errorToString(error)).join(", ");
    log(`${msg}. Causes: ${errorString}`);
    capture.message(msg, {
      extra: {
        errorsCount: getRostersErrors.length,
        errors: errorString,
        context: "quest.ingest-all-responses",
      },
      level: "warning",
    });
  }
  const rostersMissingDateId = rosters.flatMap(roster => {
    const metadataSafeParse = questRosterMetadataSchema.safeParse(roster.data);
    if (metadataSafeParse.success) {
      const metadata = metadataSafeParse.data;
      if (metadata.dateId) return [];
      return [{ roster, metadata }];
    }
    return [];
  });
  const updateRostersErrors: unknown[] = [];
  await executeAsynchronously(
    rostersMissingDateId,
    async roster => {
      try {
        await updateRoster({
          rosterId: roster.roster.id,
          cxId: roster.roster.cxId,
          data: { ...roster.metadata, dateId },
        });
      } catch (error) {
        updateRostersErrors.push(error);
      }
    },
    { numberOfParallelExecutions: MAX_PARALLEL_ROSTER_UPDATES }
  );
  if (updateRostersErrors.length > 0) {
    const msg = `Failed to update some Quest rosters while ingesting all responses`;
    const errorString = updateRostersErrors.map(error => errorToString(error)).join(", ");
    log(`${msg}. Causes: ${errorString}`);
    capture.message(msg, {
      extra: {
        dateId,
        rosterType,
        errorsCount: updateRostersErrors.length,
        errors: errorString,
        context: "quest.ingest-all-responses",
      },
      level: "warning",
    });
  }
}
