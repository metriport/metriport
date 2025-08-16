import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { ECUpdater, StoreECAfterDocQueryCmd, StoreECAfterIncludeListCmd } from "./ec-updater";

dayjs.extend(duration);

const UPDATE_TIMEOUT = dayjs.duration({ minutes: 2 });

export class ECUpdaterAPI extends ECUpdater {
  constructor(private readonly apiUrl: string) {
    super();
  }

  async storeECAfterIncludeList({
    ecId,
    cxId,
    patientIds,
    cqOrgIds,
  }: StoreECAfterIncludeListCmd): Promise<void> {
    const endpoint = "/internal/patient/enhance-coverage/after-include-list";
    console.log(
      `Calling API ${endpoint} w/ ${patientIds.length} patients and ${cqOrgIds.length} orgs.`
    );
    const params = new URLSearchParams({
      ecId,
      cxId,
      patientIds: patientIds.join(","),
      cqOrgIds: cqOrgIds.join(","),
    });
    await axios.post(
      `${this.apiUrl}/internal/patient/enhance-coverage/after-include-list?${params.toString()}`,
      undefined,
      { timeout: UPDATE_TIMEOUT.asMilliseconds() }
    );
  }

  async storeECAfterDocQuery({
    ecId,
    cxId,
    patientId,
    docsFound,
  }: StoreECAfterDocQueryCmd): Promise<void> {
    const endpoint = "/internal/patient/enhance-coverage/after-doc-query";
    console.log(`Calling API ${endpoint} w/ patient ${patientId}, found ${docsFound} docs.`);
    const params = new URLSearchParams({
      ecId,
      cxId,
      patientId,
      docsFound: docsFound.toString(),
    });
    await axios.post(`${this.apiUrl}${endpoint}?${params.toString()}`, undefined, {
      timeout: UPDATE_TIMEOUT.asMilliseconds(),
    });
  }
}
