import { encodeToHtml } from "@metriport/shared/common/html";

export function formatIdAsHl7v2({
  patientId,
  assignAuthority,
  assignAuthorityType = "ISO",
}: {
  patientId: string;
  assignAuthority: string;
  assignAuthorityType?: string | undefined;
}): string {
  return `${patientId}^^^&${assignAuthority}&${assignAuthorityType}`;
}

export function formatPatientIdAsHl7v2Encoded({
  patientId,
  assignAuthority,
  assignAuthorityType,
}: {
  patientId: string;
  assignAuthority: string;
  assignAuthorityType?: string;
}): string {
  const patientIdInHl7Format = formatIdAsHl7v2({
    patientId,
    assignAuthority,
    assignAuthorityType,
  });
  return encodeToHtml(patientIdInHl7Format);
}
