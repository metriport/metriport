import { DatasourceQueryStatus } from "@metriport/shared/domain/network-query/source";
import { MetriportError } from "@metriport/shared";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import { bulkUpdateDatasourceQueryStatus } from "../../../../command/network-query/api/bulk-update-datasource-query-status";
import { out } from "../../../../util";
import { QuestSftpClient } from "../../client";
import { QuestRosterRequest, QuestUploadRosterHandler } from "./upload-roster";
import { closeRoster } from "./utils";

export class QuestUploadRosterHandlerDirect implements QuestUploadRosterHandler {
  constructor(private readonly client = new QuestSftpClient()) {}

  async uploadRoster(rosterRequest: QuestRosterRequest): Promise<void> {
    const { log } = out("quest.uploadRoster.direct");
    const rosterResult = await closeRoster(rosterRequest);
    if (!rosterResult) return;
    const { patients } = rosterResult;

    try {
      await this.client.uploadRoster(rosterResult);
      log(`Uploaded roster ${rosterResult.rosterFileName}`);
      await bulkUpdateDatasourceQueryStatus({
        patients,
        source: "lab",
        specificSource: questSource,
        fromStatuses: [DatasourceQueryStatus.OnRoster],
        toStatus: DatasourceQueryStatus.Requested,
      });
    } catch (error) {
      const msg = `Failed to upload roster for Quest`;
      log(msg);
      await bulkUpdateDatasourceQueryStatus({
        patients,
        source: "lab",
        specificSource: questSource,
        fromStatuses: [DatasourceQueryStatus.OnRoster],
        toStatus: DatasourceQueryStatus.Failed,
      });
      throw new MetriportError(msg, error, { cxId: rosterRequest.cxId });
    }
  }
}
