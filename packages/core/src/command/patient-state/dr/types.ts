import { PatientStateBaseParams, Status } from "../types";

export type CreateDrParams = {
  requestId: string;
  startedAt: string;
  status: Status;
  facilityId: string;
  countSuccess: number;
  countError: number;
  countTotal: number;
  countFilteredFromRedownload: number;
  forceDownload: boolean;
};
export type GetDrParams = CreateDrParams & {
  reason?: string;
};

export type UpdateDrParams = Partial<CreateDrParams> & {
  requestId: string;
  reason?: string;
};

export type CreatePatientStateDrParams = PatientStateBaseParams & {
  params: CreateDrParams;
};
