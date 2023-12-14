import { BaseDomainCreate } from "../base-domain";

export interface BaseResultDomain extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
}

export type Issue = {
  severity: string;
  code: string;
  details: { text: string };
};

export type OperationOutcome = {
  resourceType: string;
  id: string;
  issue: Issue[];
};

export type BaseResponse = {
  id: string;
  cxId: string;
  timestamp: string;
  responseTimestamp: string;
  xcpdPatientId?: { id: string; system: string };
  patientId: string;
  operationOutcome?: OperationOutcome;
};

export type DocumentReference = {
  homeCommunityId: string;
  docUniqueId: string;
  repositoryUniqueId: string;
  contentType?: string | null;
  language?: string | null;
  uri?: string | null;
  creation?: string | null;
  title?: string | null;
};
