import { PurposeOfUse } from "@metriport/shared";
import { BaseRequestMetadata } from "../client/common";
import { PatientResponseItem } from "../models/patient";

export type EncodePatientIdForDocumentExchangeParams = {
  patientId: string;
  assignAuthority: string;
};

/**
 * Regex pattern to extract code, system, and optional assignAuthType from CommonWell patient ID
 * Matches: code^^^&system&assignAuthType
 * Where assignAuthType is optional
 */
export const CW_PATIENT_ID_REGEX = /^(.+)\^\^\^&([^&]+)(?:&(.+))?$/i;

/**
 * Get the local Patient ID from the Patient Collection Item's Self link.
 * This ID is in the HL7 CX data type format, so it includes the system/assigninig authority's system.
 *
 * @param object - The Patient Collection Item.
 * @returns The Patient ID.
 */
export function getCwPatientIdFromCollectionItem(
  object: Pick<PatientResponseItem, "Links">
): string | undefined {
  const url = object.Links?.Self;
  if (!url) return undefined;
  const isLastCharSlash = url.endsWith("/");
  const removeTrailingSlash = isLastCharSlash ? url.substring(0, url.length - 1) : url;
  return removeTrailingSlash.substring(removeTrailingSlash.lastIndexOf("/") + 1);
}

/**
 * Get the Edge System's patient ID from the Patient Object Response Item.
 * This is the decoded patient ID, NOT in the HL7 CX data type format.
 *
 * @param patientResponseItem - The Patient Object Response Item.
 * @returns The Edge System's patient ID.
 * @see decodeCwPatientId
 * @see Section "8.3.2 Get Patient" of the spec.
 */
export function getPatientIdFromCollectionItem(
  patientResponseItem: Pick<PatientResponseItem, "Links">
): string {
  const cwPatientId = getCwPatientIdFromCollectionItem(patientResponseItem);
  if (!cwPatientId) throw new Error(`Could not get CW patient ID from collection item`);
  const decoded = decodeCwPatientId(cwPatientId);
  const patientId = decoded.value;
  if (!patientId) throw new Error(`PatientId could not be decoded from ${cwPatientId}`);
  return patientId;
}

/**
 * Decodes the patient ID in the HL7 CX data type format into its components.
 *
 * @param patientId - The patient's ID in the HL7 CX data type format.
 * @returns The decoded patient ID, with the value, assignAuthority, and assignAuthorityType.
 * @see Section "8.3.2 Get Patient" of the spec.
 */
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
    const { value, assignAuthority } = decodeCwPatientId(params);
    return value && assignAuthority
      ? encodePatientIdForDocumentExchange({
          patientId: value,
          assignAuthority,
        })
      : undefined;
  }
  const { patientId, assignAuthority } = params;
  return `${assignAuthority}|${patientId}`;
}

export function buildBaseQueryMeta(orgName: string): BaseRequestMetadata {
  return {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${orgName} System User`,
  };
}
