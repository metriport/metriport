import { PurposeOfUse } from "@metriport/shared";
import { BaseRequestMetadata } from "../client/common";
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
  return value && assignAuthority
    ? encodeToDocumentExchange({
        patientId: value,
        assignAuthority,
      })
    : undefined;
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
  return `${patientId}^^^&${assignAuthority}&${assignAuthorityType ?? "ISO"}`;
}

/**
 * Converts the patient ID into subject ID, to be used during document query.
 *
 * @param patientId - The patient's ID.
 * @param assignAuthority - The assign authority of the patient.
 * @returns The subject ID as defined by the specification: [system]|[code] where 'system'
 * is the OID of the organization and 'code' is the first part of the patient ID.
 */
export function encodeToDocumentExchange({
  patientId,
  assignAuthority,
}: {
  patientId: string;
  assignAuthority: string;
}): string {
  return `${assignAuthority}|${patientId}`;
}

export function encodeId(id: string): string {
  return encodeURIComponent(id);
}

export function buildBaseQueryMeta(orgName: string): BaseRequestMetadata {
  return {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${orgName} System User`,
  };
}
