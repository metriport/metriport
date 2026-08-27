import { DatasourceQueryStatus } from "@metriport/shared/domain/network-query/source";
import { MetriportError } from "@metriport/shared";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import { bulkUpdateDatasourceQueryStatus } from "../../../../command/network-query/api/bulk-update-datasource-query-status";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsRosterRequest, SurescriptsUploadRosterHandler } from "./upload-roster";
import { closeRoster } from "./utils";

export class SurescriptsUploadRosterHandlerDirect implements SurescriptsUploadRosterHandler {
  constructor(
    private readonly client = new SurescriptsSftpClient({ port: Config.getSurescriptsPort() })
  ) {}

  async uploadRoster(rosterRequest: SurescriptsRosterRequest): Promise<void> {
    const { log } = out("ss.uploadRoster.direct");
    const batchRequestData = await closeRoster(rosterRequest);
    if (!batchRequestData) return;
    const { cxId } = batchRequestData;

    try {
      const result = await this.client.sendBatchRequest(batchRequestData);

      if (!result || Object.keys(result).length < 1) {
        log(`No patients requested for roster ${batchRequestData.populationId}`);
        return;
      }

      const requestedPatientIds = [...new Set(Object.values(result).flat())];
      const totalPatients = requestedPatientIds.length;
      const totalFiles = Object.keys(result).length;
      log(
        `Uploaded roster ${batchRequestData.populationId} with ${totalPatients} patients in ${totalFiles} file(s)`
      );

      const patients = requestedPatientIds.map(patientId => ({ cxId, patientId }));
      await bulkUpdateDatasourceQueryStatus({
        patients,
        source: "pharmacy",
        specificSource: surescriptsSource,
        fromStatuses: [DatasourceQueryStatus.OnRoster],
        toStatus: DatasourceQueryStatus.Requested,
      });
    } catch (error) {
      const msg = `Failed to upload roster for Surescripts`;
      log(msg);
      const patients = batchRequestData.patients.map(p => ({ cxId, patientId: p.id }));
      await bulkUpdateDatasourceQueryStatus({
        patients,
        source: "pharmacy",
        specificSource: surescriptsSource,
        fromStatuses: [DatasourceQueryStatus.OnRoster],
        toStatus: DatasourceQueryStatus.Failed,
      });
      throw new MetriportError(msg, error, { cxId });
    }
  }
}
