import { BaseDomainCreate } from "../base-domain";

export interface BaseResultDomain extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
}

export type IHEResultStatus = "success" | "failure";

export function getIheResultStatus({
  patientMatch,
  docRefLength,
}: {
  patientMatch?: boolean;
  docRefLength?: number;
}): IHEResultStatus {
  // explicitly checking for a boolean value for patientMatch because it can be undefined
  if (patientMatch === true || (docRefLength !== undefined && docRefLength >= 1)) return "success";
  return "failure";
}
