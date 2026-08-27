import { AuditEventEntity } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { formatIdAsHl7v2 } from "../../external/hie-shared/ids";
import { stripUrnPrefix } from "../../util/urn";

export type AtnaAuditEvent = string;

// Query transactions that must have EventActionCode = "E"
export const QUERY_TRANSACTIONS = ["ITI-55", "ITI-38", "ITI-18"];

// Agent type codes per IHE ITI TF-2b
export const SOURCE_ROLE_CODE = "110153";
export const SOURCE_ROLE_DISPLAY = "Source Role ID";
export const DESTINATION_ROLE_CODE = "110152";
export const DESTINATION_ROLE_DISPLAY = "Destination Role ID";

/**
 * Formats a patient identifier to HL7 CX format required by ATNA.
 * Format: value^^^&assigningAuthorityOID&ISO
 *
 * @param entity - The AuditEventEntity containing patient information
 * @param useExternalGatewayPatientId - If true, use the external gateway patient ID from entity.detail
 *   (for inbound/responder flows where we need to return the same patient ID that was sent to us)
 */
export function auditEventPatientIdToHl7v2(
  entity: AuditEventEntity,
  useExternalGatewayPatientId = false
): string {
  const identifier = entity.what?.identifier;
  const reference = entity.what?.reference;
  const display = entity.what?.display;

  // For inbound/responder flows, prefer the external gateway patient ID from detail
  // This is the patient ID that was sent by the external gateway and should be used in the audit log
  let value = identifier?.value ?? "";
  if (useExternalGatewayPatientId && entity.detail) {
    const externalPatientIdDetail = entity.detail.find(d => d.type === "externalGatewayPatientId");
    if (externalPatientIdDetail?.valueString) {
      value = externalPatientIdDetail.valueString;
    }
  }

  const system = identifier?.system ?? "";

  if (!value && reference) {
    const parts = reference.split("/");
    value = parts.pop() ?? reference;
  }

  if (!value && display) {
    value = display;
  }

  if (value.includes("^^^")) return value;

  if (!system) {
    throw new MetriportError(
      `Patient entity requires 'what.identifier.system' (an OID) to construct valid CX format. `
    );
  }

  let oid = system;
  if (system.startsWith("urn:oid:")) {
    oid = system.substring(8);
  } else if (system.startsWith("urn:")) {
    oid = system.substring(4);
  }

  return formatIdAsHl7v2({ patientId: value, assignAuthority: oid });
}

export function mapSystemOidToName(oid: string): string {
  const bareOid = stripUrnPrefix(oid);
  switch (bareOid) {
    case "2.16.840.1.113883.6.96":
      return "SNOMED CT";
    case "2.16.840.1.113883.6.101":
      return "NUCC";
    case "2.16.840.1.113883.5.111":
      return "RoleCode";
    case "1.2.840.10008.2.16.4":
      return "DCM";
    case "2.16.840.1.113883.5.1008":
      return "NullFlavor";
  }
  return bareOid;
}
