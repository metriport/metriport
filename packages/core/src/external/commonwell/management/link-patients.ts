import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientUpdater } from "../../../domain/patient/patient-updater";
import { sleep } from "../../../util/sleep";
import { CommonWellManagementAPI } from "./api";

dayjs.extend(duration);

const TIME_BETWEEN_INCLUDE_LIST_AND_UPDATE_ALL = dayjs.duration({ seconds: 2 });

export type LinkPatientsCommand = {
  cxId: string;
  cxOrgOID: string;
  patientIds: string[];
  cqOrgIds: string[];
};

/**
 * Updates the include list on CW and triggers an update on our DB.
 */
export class LinkPatients {
  constructor(
    private readonly cwManagementApi: CommonWellManagementAPI,
    private readonly patientsUpdater: PatientUpdater
  ) {}

  async linkPatientsToOrgs({
    cxId,
    cxOrgOID,
    patientIds,
    cqOrgIds,
  }: LinkPatientsCommand): Promise<void> {
    await this.cwManagementApi.updateIncludeList({ oid: cxOrgOID, careQualityOrgIds: cqOrgIds });

    // Give some time for the cache - if any, on CW's side to catch up
    await sleep(TIME_BETWEEN_INCLUDE_LIST_AND_UPDATE_ALL.asMilliseconds());

    await this.patientsUpdater.updateAll(cxId, patientIds);
  }
}
