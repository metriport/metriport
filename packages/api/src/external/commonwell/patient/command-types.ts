import { Patient } from "@metriport/core/domain/patient";

export type UpdatePatientCmd = {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId?: string;
  forceCWUpdate?: boolean;
  rerunPdOnNewDemographics?: boolean;
};
