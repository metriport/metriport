import { isBackfillRosterType } from "@metriport/shared/interface/external/quest/roster";
import { executeAsynchronously } from "../../../../util/concurrency";
import { errorToString } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { QuestResponseFile, QuestSftpClient } from "../../client";
import { parseResponseFileName } from "../../file/file-names";
import { QuestReplica } from "../../replica";
import { buildQuestConvertPatientResponseHandler } from "../convert-patient-response/convert-patient-response-factory";
import {
  QuestIngestAllResponsesHandler,
  QuestIngestAllResponsesParams,
} from "./ingest-all-responses";
import { splitResponseFilesIntoQuestPatientResponseFiles, updateRosters } from "./utils";

const maxParallelRosterUpdates = 2;
const maxParallelQuestPatientResponseConversions = 10;

export class QuestIngestAllResponsesHandlerDirect implements QuestIngestAllResponsesHandler {
  constructor(
    private readonly client: QuestSftpClient = new QuestSftpClient(),
    private readonly replica: QuestReplica = new QuestReplica(),
    private readonly next = buildQuestConvertPatientResponseHandler()
  ) {}

  async ingestAllResponses(params?: QuestIngestAllResponsesParams): Promise<void> {
    const { log } = out("quest.ingestAllResponses.direct");
    const fileNameOverrides = params?.fileNameOverrides;
    const responses = fileNameOverrides
      ? await this.client.readResponseFilesFromReplica(fileNameOverrides)
      : await this.client.downloadAllNewResponses();
    const source = fileNameOverrides ? "replica" : "SFTP";
    log(`Got ${responses.length} response files from ${source}`);
    // Update backfill rosters so that we can map a roster to its response file
    await executeAsynchronously(
      responses,
      async (responseFile: QuestResponseFile) => {
        const { dateId, rosterType } = parseResponseFileName(responseFile.fileName);
        if (!isBackfillRosterType(rosterType)) return;
        await updateRosters({ dateId, rosterType });
      },
      { numberOfParallelExecutions: maxParallelRosterUpdates }
    );
    const patientResponseFiles = splitResponseFilesIntoQuestPatientResponseFiles(responses);
    const errors: unknown[] = [];
    await executeAsynchronously(
      patientResponseFiles,
      async patientResponseFile => {
        try {
          const { externalId, dateId, rosterType, fileContent } = patientResponseFile;
          await this.replica.uploadQuestPatientResponseFile({
            externalId,
            dateId,
            rosterType,
            fileContent,
          });
          await this.next.convertQuestPatientResponse({ externalId, dateId, rosterType });
        } catch (error) {
          errors.push(error);
        }
      },
      {
        numberOfParallelExecutions: maxParallelQuestPatientResponseConversions,
      }
    );
    if (errors.length > 0) {
      const msg = `Failed to upload and convert some Quest patient responses`;
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
  }
}
