import { BaseDomainCreate } from "../base-domain";
import { OperationOutcome } from "@metriport/ihe-gateway-sdk";

export interface BaseResultDomain extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
}

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
