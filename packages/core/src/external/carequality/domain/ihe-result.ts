export interface BaseResultDomain {
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

export type IHEResultStatus = "success" | "failure";

export function getIheResultStatus({
  operationOutcome,
  patientMatch,
  docRefLength,
}: {
  operationOutcome?: OperationOutcome | undefined | null;
  patientMatch?: boolean;
  docRefLength?: number;
}): IHEResultStatus {
  // explicitly checking for a boolean value for patientMatch because it can be undefined
  if (operationOutcome?.issue || patientMatch === false || docRefLength === 0) return "failure";
  return "success";
}
