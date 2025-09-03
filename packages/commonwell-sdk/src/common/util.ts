import { PurposeOfUse } from "@metriport/shared";
import { BaseRequestMetadata } from "../client/common";
import { PatientLinks } from "../models/patient";

export type EncodePatientIdForDocumentExchangeParams = {
  patientId: string;
  assignAuthority: string;
};

/**
 * Regex pattern to extract code, system, and optional assignAuthType from CommonWell patient ID
 * Matches: code^^^&system&assignAuthType
 * Where assignAuthType is optional
 */
export const CW_PATIENT_ID_REGEX_V2 = /^(.+)\^\^\^&([^&]+)(?:&(.+))?$/i;

/**
 * Get the local Patient ID from the Patient Response Item's Links Self link.
 * This ID is in the HL7 CX data type format, so it includes the system/assigninig authority's system.
 *
 * @param links - The Patient Links.
 * @returns The Patient ID.
 * @see Section "8.3.2 Get Patient" of the spec.
 */
export function getCwPatientIdFromLinks(links: PatientLinks): string {
  const url = links.Self;
  const isLastCharSlash = url.endsWith("/");
  const removeTrailingSlash = isLastCharSlash ? url.substring(0, url.length - 1) : url;
  return removeTrailingSlash.substring(removeTrailingSlash.lastIndexOf("/") + 1);
}

/**
 * Decodes the patient ID in the HL7 CX data type format into its components.
 *
 * @param patientId - The patient's ID in the HL7 CX data type format.
 * @returns The decoded patient ID, with the value, assignAuthority, and assignAuthorityType.
 * @see Section "8.3.2 Get Patient" of the spec.
 */
export function decodeCwPatientIdV2(patientId: string): {
  value: string | undefined;
  assignAuthority: string | undefined;
  assignAuthorityType: string | undefined;
} {
  const decoded = decodeURIComponent(decodeURI(patientId));
  const match = decoded.match(CW_PATIENT_ID_REGEX_V2) ?? undefined;
  const value = match && match[1];
  const assignAuthority = match && match[2];
  const assignAuthorityType = match && match[3];
  return { value, assignAuthority, assignAuthorityType };
}

/**
 * Encodes the patient ID into the HL7 CX data type format.
 *
 * @param patientId - The patient's ID.
 * @param assignAuthority - The assign authority of the patient.
 * @param assignAuthorityType - The assign authority type of the patient.
 * @returns The patient ID in the HL7 CX data type format.
 * @see Section "8.3.2 Get Patient" of the spec.
 */
export function encodeCwPatientId({
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
 * @param cwPatientId - The patient's ID in the HL7 CX data type format.
 * @returns The subject ID as defined by the specification: [system]|[code] where 'system'
 * is the OID of the organization and 'code' is the first part of the patient ID.
 * @see Sectin "10.2.1 Document Query" of the spec.
 */
export function encodePatientIdForDocumentExchange(cwPatientId: string): string | undefined;

/**
 * Converts the patient ID into subject ID, to be used during document query.
 *
 * @param patientId - The patient's ID from the Edge System, unencoded.
 * @param assignAuthority - The assign authority of the patient.
 * @returns The subject ID as defined by the specification: [system]|[code] where 'system'
 * is the OID of the organization and 'code' is the first part of the patient ID.
 * @see Sectin "10.2.1 Document Query" of the spec.
 */
export function encodePatientIdForDocumentExchange({
  patientId,
  assignAuthority,
}: EncodePatientIdForDocumentExchangeParams): string;

export function encodePatientIdForDocumentExchange(
  params: EncodePatientIdForDocumentExchangeParams | string
): string | undefined {
  if (typeof params === "string") {
    const { value, assignAuthority } = decodeCwPatientIdV2(params);
    if (value && assignAuthority) {
      return encodePatientIdForDocumentExchange({
        patientId: value,
        assignAuthority,
      });
    }
    return convertPatientIdToSubjectIdV1(params);
  }
  const { patientId, assignAuthority } = params;
  return `${assignAuthority}|${patientId}`;
}

/**
 * V1 only
 * Matches: patientId^^^urn:oid:orgOid
 */
function convertPatientIdToSubjectIdV1(patientId: string): string | undefined {
  const value = decodeURIComponent(decodeURI(patientId));
  const regex = /(.+)\^\^\^(.+)/i;
  const match = value.match(regex);
  const code = match && match[1];
  const system = match && match[2];
  return code && system ? buildPatiendIdToDocQuery(code, system) : undefined;
}
function buildPatiendIdToDocQuery(code: string, system: string): string {
  return `${system}|${code}`;
}

export function buildBaseQueryMeta(orgName: string): BaseRequestMetadata {
  return {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${orgName} System User`,
  };
}
