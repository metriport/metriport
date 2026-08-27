import { MedicalDataSource } from "../../external";
import {
  CreateConversionParams,
  GetConversionParams,
  UpdateConversionParams,
} from "./conversion/types";
import { CreateDqParams, GetDqParams, UpdateDqParams } from "./dq/types";
import { CreateDrParams, GetDrParams, UpdateDrParams } from "./dr/types";
import { CreatePdParams, GetPdParams, UpdatePdParams } from "./pd/types";

export enum Status {
  processing = "processing",
  completed = "completed",
  failed = "failed",
}

export type PatientStateBaseParams = {
  patientId: string;
  cxId: string;
  network: MedicalDataSource;
};

export type PatientStateKey = PatientStateBaseParams & {
  requestId: string;
  reason?: string;
};

export type PatientState = {
  pd?: GetPdParams;
  dq?: GetDqParams;
  dr?: GetDrParams;
  conversion?: GetConversionParams;
  ttl: number;
  createdAt: string;
  cxId: string;
  patientId: string;
  network: MedicalDataSource;
  requestId: string;
};

export type CreateOrUpdatePatientState = {
  pd?: CreatePdParams | UpdatePdParams;
  dq?: CreateDqParams | UpdateDqParams;
  dr?: CreateDrParams | UpdateDrParams;
  conversion?: CreateConversionParams | UpdateConversionParams;
};

export type StatusCondition = {
  field: "pd" | "dq" | "dr" | "conversion";
  operator: "equals" | "notEquals";
  value: Status;
};
