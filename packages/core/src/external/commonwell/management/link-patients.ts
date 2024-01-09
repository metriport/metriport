import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientUpdater } from "../../../command/patient-updater";
import { sleep } from "../../../util/sleep";
import { ECUpdater } from "../cq-bridge/ec-updater";
import { CommonWellManagementAPI } from "./api";

dayjs.extend(duration);

const TIME_BETWEEN_INCLUDE_LIST_AND_UPDATE_ALL = dayjs.duration({ seconds: 2 });

export type LinkPatientsCommand = {
  ecId: string;
  cxId: string;
  cxOrgOID: string;
  patientIds: string[];
  cqOrgIds: string[];
  log?: typeof console.log;
};

/**
 * Updates the include list on CW and triggers an update on our DB.
 */
export class LinkPatients {
  constructor(
    private readonly cwManagementApi: CommonWellManagementAPI,
    private readonly patientsUpdater: PatientUpdater,
    private readonly ecUpdater: ECUpdater
  ) {}

  async linkPatientsToOrgs({
    ecId,
    cxId,
    cxOrgOID,
    patientIds,
    cqOrgIds,
    log,
  }: LinkPatientsCommand): Promise<void> {
    await this.cwManagementApi.updateIncludeList({
      oid: cxOrgOID,
      careQualityOrgIds: cqOrgIds,
      log,
    });

    // Give some time for the cache - if any, on CW's side to catch up
    await sleep(TIME_BETWEEN_INCLUDE_LIST_AND_UPDATE_ALL.asMilliseconds());

    await this.patientsUpdater.updateAll(cxId, patientIds);

    // intentionally not in parallel with updteAll so we only update this if updateAll works
    await this.ecUpdater.storeECAfterIncludeList({
      ecId,
      cxId,
      patientIds,
      cqOrgIds,
    });
  }
}
