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
  /**
   * Indicates whether to make changes to internal and external services or not, used to validate
   * the overall setup/infra.
   */
  dryRun?: boolean | undefined;
  log?: typeof console.log;
};

/**
 * Updates the include list on CW and triggers an update on our DB.
 */
export class LinkPatients {
  constructor(
    private readonly cwManagementApi: CommonWellManagementAPI,
    private readonly patientsUpdater: PatientUpdater
  ) {}

  /**
   * Links Patients to CQ orgs using CW's CQ bridge.
   * It updates the include list for the cx @ CW and then issues an update on all provided
   * patient IDs so they get linked to those orgs @ CW's CQ bridge.
   *
   * @param dryRun indicates whether to make changes to internal and external services or not,
   *               used to validate the overall setup/infra
   */
  async linkPatientsToOrgs({
    cxId,
    cxOrgOID,
    patientIds,
    cqOrgIds,
    dryRun,
    log,
  }: LinkPatientsCommand): Promise<void> {
    await this.cwManagementApi.updateIncludeList({
      oid: cxOrgOID,
      careQualityOrgIds: cqOrgIds,
      dryRun,
      log,
    });

    // Give some time for the cache - if any, on CW's side to catch up
    await sleep(TIME_BETWEEN_INCLUDE_LIST_AND_UPDATE_ALL.asMilliseconds());

    if (!dryRun) await this.patientsUpdater.updateAll(cxId, patientIds);
  }
}
