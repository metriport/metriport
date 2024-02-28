import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface BaseResultDomain extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
}

export type IHEResultStatus = "success" | "failure";

export function getPDResultStatus({
  patientMatch,
}: {
  patientMatch?: boolean | null;
}): IHEResultStatus {
  return patientMatch ? "success" : "failure";
}

export function getDQResultStatus(
  params: Parameters<typeof getDocumentResultStatus>[0]
): IHEResultStatus {
  return getDocumentResultStatus(params);
}
export function getDRResultStatus(
  params: Parameters<typeof getDocumentResultStatus>[0]
): IHEResultStatus {
  return getDocumentResultStatus(params);
}
function getDocumentResultStatus({ docRefLength }: { docRefLength?: number }): IHEResultStatus {
  if (docRefLength !== undefined && docRefLength >= 1) return "success";
  return "failure";
}
