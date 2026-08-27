import { out } from "../../../../util/log";
import { getPatientMapping } from "../../api/get-patient-mapping";
import { parseResponseFile } from "../../file/file-parser";
import { QuestReplica } from "../../replica";
import { buildAndRecreateConsolidatedBundle } from "../bundle/build-and-recreate-consolidated-bundle";
import { buildAndSaveConversionBundle } from "../bundle/build-and-save-conversion-bundle";
import {
  QuestConvertPatientResponseHandler,
  QuestPatientResponse,
} from "./convert-patient-response";

export class QuestConvertPatientResponseHandlerDirect
  implements QuestConvertPatientResponseHandler
{
  constructor(private readonly replica: QuestReplica = new QuestReplica()) {}

  async convertQuestPatientResponse(response: QuestPatientResponse): Promise<void> {
    const { externalId, dateId, rosterType } = response;
    const { log } = out(
      `quest.convertQuestPatientResponse.direct - externalId ${externalId}, dateId ${dateId}, rosterType ${rosterType}`
    );
    const { patientId, cxId } = await getPatientMapping({ externalId });

    const questPatientResponseFile = await this.replica.getQuestPatientResponseFile({
      externalId,
      dateId,
      rosterType,
    });
    const rows = parseResponseFile(questPatientResponseFile);

    await buildAndSaveConversionBundle({ cxId, patientId, rows, dateId, rosterType });
    await buildAndRecreateConsolidatedBundle({ cxId, patientId });
    log(`Completed conversion of patient response`);
  }
}
