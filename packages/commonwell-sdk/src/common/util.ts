import { PurposeOfUse } from "@metriport/shared";
import { RequestMetadata } from "../client/commonwell";
import { StrongId } from "../models/identifier";
import { Patient, PatientCollectionItem } from "../models/patient";

/**
 * Regex pattern to extract code, system, and optional assignAuthType from CommonWell patient ID
 * Matches: code^^^&system&assignAuthType
 * Where assignAuthType is optional
 */
export const CW_PATIENT_ID_REGEX = /^(.+)\^\^\^&([^&]+)(?:&(.+))?$/i;

export function getPatientIdTrailingSlash(object: PatientCollectionItem): string | undefined {
  const url = object.Links?.Self;
  if (!url) return undefined;
  const isLastCharSlash = url.endsWith("/");
  const removeTrailingSlash = isLastCharSlash ? url.substring(0, url.length - 1) : url;
  return removeTrailingSlash.substring(removeTrailingSlash.lastIndexOf("/") + 1);
}

export function getPatientStrongIds(object: Patient): StrongId[] | undefined {
  return object.identifier ?? undefined;
}

function buildPatiendIdToDocQuery(code: string, system: string): string {
  return `${system}|${code}`;
}

/**
 * Converts the patient ID into subject ID, to be used during document query.
 *
 * @param {string} patientId - The patient's ID
 * @returns {string} - The subject ID as defined by the specification: [system]|[code] where 'system'
 * is the OID of the organization and 'code' is the first (numeric) part of the patient ID.
 *
 * @see {@link https://specification.commonwellalliance.org/services/data-broker/protocol-operations-data-broker#8781-find-documents|API spec}
 */
export function convertPatientIdToSubjectId(patientId: string): string | undefined {
  const { value, assignAuthority } = decodeCwPatientId(patientId);
  return value && assignAuthority ? buildPatiendIdToDocQuery(value, assignAuthority) : undefined;
}

export function decodeCwPatientId(patientId: string): {
  value: string | undefined;
  assignAuthority: string | undefined;
  assignAuthorityType: string | undefined;
} {
  const decoded = decodeURIComponent(decodeURI(patientId));
  const match = decoded.match(CW_PATIENT_ID_REGEX) ?? undefined;
  const value = match && match[1];
  const assignAuthority = match && match[2];
  const assignAuthorityType = match && match[3];
  return { value, assignAuthority, assignAuthorityType };
}

export function encodeToCwPatientId({
  patientId,
  assignAuthority,
  assignAuthorityType,
}: {
  patientId: string;
  assignAuthority: string;
  assignAuthorityType?: string | undefined;
}): string {
  // TODO ENG-200 CAN JUST SKIP TYPE IF NOT PROVIDED?
  return `${patientId}^^^&${assignAuthority}&${assignAuthorityType ?? "ISO"}`;
}

export function encodeId(id: string): string {
  return encodeURIComponent(id);
}

export function organizationQueryMeta(
  orgName: string,
  meta: Omit<RequestMetadata, "npi" | "role" | "purposeOfUse" | "subjectId"> &
    Required<Pick<RequestMetadata, "npi">> &
    Partial<Pick<RequestMetadata, "role" | "purposeOfUse">>
): RequestMetadata {
  const base = baseQueryMeta(orgName);
  return {
    subjectId: base.subjectId,
    role: meta.role ?? base.role,
    purposeOfUse: meta.purposeOfUse ?? base.purposeOfUse,
    npi: meta.npi,
  };
}

export const baseQueryMeta = (orgName: string) => ({
  purposeOfUse: PurposeOfUse.TREATMENT,
  role: "ict",
  subjectId: `${orgName} System User`,
});

/**
 * Extracts code, system, and optional assignAuthType from a CommonWell patient ID
 *
 * @param patientId - The patient ID in format: code^^^&system&assignAuthType
 * @returns Object with code, system, and assignAuthType (optional)
 */
export function extractCwPatientIdComponents(patientId: string): {
  code: string | undefined;
  system: string | undefined;
  assignAuthType: string | undefined;
} {
  const match = patientId.match(CW_PATIENT_ID_REGEX);
  if (!match) {
    return { code: undefined, system: undefined, assignAuthType: undefined };
  }

  return {
    code: match[1],
    system: match[2],
    assignAuthType: match[3],
  };
}
