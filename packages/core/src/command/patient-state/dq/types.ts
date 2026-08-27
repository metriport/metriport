import { PatientStateBaseParams, Status } from "../types";

export type CreateDqParams = {
  requestId: string;
  startedAt: string;
  status: Status;
  facilityId: string;
  totalGateways: number;
  gatewaySuccess: number;
  gatewayFailure: number;
  totalDocuments: number;
  forceDownload: boolean;
};

export type GetDqParams = CreateDqParams & {
  reason?: string;
};

export type UpdateDqParams = Partial<CreateDqParams> & {
  requestId: string;
  reason?: string;
};

export type CreatePatientStateDqParams = PatientStateBaseParams & {
  params: CreateDqParams;
};
