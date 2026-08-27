import { PatientStateBaseParams, Status } from "../types";

export type CreatePdParams = {
  requestId: string;
  startedAt: string;
  status: Status;
  facilityId: string;
  rerunPdOnNewDemographics: boolean;
  isForceNewPdRun?: boolean | undefined;
  totalGateways: number;
  gatewaySuccess: number;
  gatewayFailure: number;
  isTargetedQuery: boolean;
};

export type GetPdParams = CreatePdParams & {
  reason?: string;
};

export type UpdatePdParams = Partial<CreatePdParams> & {
  requestId: string;
  reason?: string;
};

export type CreatePatientStatePdParams = PatientStateBaseParams & {
  params: CreatePdParams;
};
