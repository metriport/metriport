import { PatientStateBaseParams, Status } from "../types";

export type CreateConversionParams = {
  requestId: string;
  startedAt: string;
  status: Status;
  totalToConvert: number;
  totalConverted: number;
  totalErrors: number;
};

export type GetConversionParams = CreateConversionParams & {
  reason?: string;
};

export type UpdateConversionParams = Partial<CreateConversionParams> & {
  requestId: string;
  reason?: string;
};

export type CreatePatientStateConversionParams = PatientStateBaseParams & {
  params: CreateConversionParams;
};
