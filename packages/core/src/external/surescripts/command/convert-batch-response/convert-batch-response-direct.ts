import { errorToString, NotFoundError } from "@metriport/shared";
import { SurescriptsRosterType } from "@metriport/shared/interface/external/surescripts/roster";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { parseResponseFile } from "../../file/file-parser";
import { SurescriptsReplica } from "../../replica";
import { buildConvertPatientResponseHandler } from "../convert-patient-response/convert-patient-response-factory";
import {
  SurescriptsBatchResponse,
  SurescriptsConvertBatchResponseHandler,
} from "./convert-batch-response";
import { buildPatientIdToDetailsMap } from "./utils";

dayjs.extend(duration);

const maxParallelPatientBatchResponseWrites = 100;
const minJitterMillis = dayjs.duration(100, "milliseconds").asMilliseconds();
const maxJitterMillis = dayjs.duration(1, "seconds").asMilliseconds();

/**
 * Note that this handler is only used for backfill rosters. Notifications are not implemented.
 */
export class SurescriptsConvertBatchResponseHandlerDirect
  implements SurescriptsConvertBatchResponseHandler
{
  constructor(
    private readonly replica: SurescriptsReplica = new SurescriptsReplica(),
    private readonly next = buildConvertPatientResponseHandler()
  ) {}

  async convertBatchResponse(response: SurescriptsBatchResponse): Promise<void> {
    const { cxId, transmissionId, populationId } = response;
    const { log } = out(
      `ss.convertBatchResponse.direct - cx ${cxId}, roster ${populationId}, transmission ${transmissionId}`
    );
    const rosterType = SurescriptsRosterType.BACKFILL;
    const batchResponseFile = await this.replica.getRawResponseFile({
      transmissionId,
      populationId,
    });
    if (!batchResponseFile) {
      throw new NotFoundError("No Surescripts batch response file stored", undefined, {
        transmissionId,
        populationId,
      });
    }

    const parsedBatchResponseFile = parseResponseFile(batchResponseFile);
    const patientIdDetailsMap = buildPatientIdToDetailsMap(parsedBatchResponseFile);
    log(`Found ${patientIdDetailsMap.size} patient IDs in batch response file, converting...`);
    const errors: unknown[] = [];

    await executeAsynchronously(
      Array.from(patientIdDetailsMap.entries()),
      async ([patientId, details]) => {
        try {
          if (!details || details.length < 1) return;
          await this.replica.uploadPatientResponseFile({
            cxId,
            patientId,
            transmissionId,
            populationId,
            rosterType,
            fileContent: Buffer.from(JSON.stringify(details)),
          });
          await this.next.convertPatientResponse({
            cxId,
            patientId,
            transmissionId,
            populationId,
            rosterType,
          });
        } catch (error) {
          errors.push(error);
        }
      },
      {
        numberOfParallelExecutions: maxParallelPatientBatchResponseWrites,
        maxJitterMillis,
        minJitterMillis,
      }
    );

    if (errors.length > 0) {
      const msg = `Failed to convert some Surescripts patient batch responses`;
      const errorString = errors.map(error => errorToString(error)).join(", ");
      log(`${msg}. Causes: ${errorString}`);
      capture.message(msg, {
        extra: {
          errorsCount: errors.length,
          errors: errorString,
          context: "surescripts.convert-batch-response",
        },
        level: "warning",
      });
    }
  }
}
