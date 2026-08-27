import { errorToString } from "@metriport/shared";
import { getCxIdForRoster } from "../../../../command/roster/api/get-cx-id-for-roster";
import { executeAsynchronously } from "../../../../util/concurrency";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { SurescriptsSftpClient } from "../../client";
import { buildConvertBatchResponseHandler } from "../convert-batch-response/convert-batch-response-factory";
import {
  SurescriptsIngestAllResponsesHandler,
  SurescriptsIngestAllResponsesParams,
} from "./ingest-all-responses";

const maxParallelBatchConversionInvocations = 10;

export class SurescriptsIngestAllResponsesHandlerDirect
  implements SurescriptsIngestAllResponsesHandler
{
  constructor(
    private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient({
      port: Config.getSurescriptsPort(),
    }),
    private readonly next = buildConvertBatchResponseHandler()
  ) {}

  async ingestAllResponses(params?: SurescriptsIngestAllResponsesParams): Promise<void> {
    const { log } = out("ss.ingestAllResponses.direct");
    const fileNameOverrides = params?.fileNameOverrides;
    const responseFiles = fileNameOverrides
      ? await this.client.readResponseFilesFromReplica(fileNameOverrides)
      : await this.client.downloadAllNewResponses();
    const source = fileNameOverrides ? "replica" : "SFTP";
    log(`Got ${responseFiles.length} response files from ${source}`);
    const errors: unknown[] = [];
    await executeAsynchronously(
      responseFiles,
      async responseFile => {
        try {
          const { populationId, transmissionId } = responseFile;
          const cxId = await getCxIdForRoster(populationId);
          await this.next.convertBatchResponse({
            cxId,
            transmissionId,
            populationId,
          });
        } catch (error) {
          errors.push(error);
        }
      },
      {
        numberOfParallelExecutions: maxParallelBatchConversionInvocations,
      }
    );
    if (errors.length > 0) {
      const msg = `Failed to convert some Surescripts batch responses`;
      const errorString = errors.map(error => errorToString(error)).join(", ");
      log(`${msg}. Causes: ${errorString}`);
      capture.message(msg, {
        extra: {
          errorsCount: errors.length,
          errors: errorString,
          context: "surescripts.ingest-all-responses",
        },
        level: "warning",
      });
    }
  }
}
