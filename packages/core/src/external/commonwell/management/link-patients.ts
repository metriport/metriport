import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CommonWellManagementAPI } from "./api";

dayjs.extend(duration);

const UPDATE_TIMEOUT = dayjs.duration({ minutes: 2 });

/**
 * Manages the session on the CommonWell management portal.
 */
export type LinkPatientsConfig = {
  cwManagementApi: CommonWellManagementAPI;
  apiUrl: string;
};
export type LinkPatientsCommand = {
  cxId: string;
  cxOrgOID: string;
  patientIds: string[];
  cqOrgIds: string[];
};

export class LinkPatients {
  private readonly cwManagementApi: CommonWellManagementAPI;
  private readonly apiUrl: string;

  constructor(params: LinkPatientsConfig) {
    this.cwManagementApi = params.cwManagementApi;
    this.apiUrl = params.apiUrl;
  }

  async linkPatientToOrgs({
    cxId,
    cxOrgOID,
    patientIds,
    cqOrgIds,
  }: LinkPatientsCommand): Promise<void> {
    await this.cwManagementApi.updateIncludeList({ oid: cxOrgOID, careQualityOrgIds: cqOrgIds });

    console.log(`Calling API /update-all...`);
    await axios.post(
      `${this.apiUrl}/internal/patient/update-all?cxId=${cxId}`,
      {
        patientIds,
      },
      { timeout: UPDATE_TIMEOUT.asMilliseconds() }
    );
  }
}
