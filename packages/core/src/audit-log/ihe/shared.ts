import { AuditEventEntity } from "@medplum/fhirtypes";
import { OperationOutcome } from "@metriport/ihe-gateway-sdk";
import { MetriportError, stringToBase64 } from "@metriport/shared";
import { defaultSubjectRole } from "../../external/ehex/ehex-gateway/shared";
import { Config } from "../../util/config";
import { SamlAttributes } from "@metriport/ihe-gateway-sdk";

// TODO ENG-1601 Review if needed
// export const AUDIT_SYSTEM_NAME = "Metriport Audit System";
export const SYSTEM_ROOT_OID = Config.getSystemRootOID();

export const FHIR_SYSTEM_URI = "http://terminology.hl7.org/CodeSystem/v3-ActReason";

export const externalGatewayPatientIdDetailType = "externalGatewayPatientId";

export const NHIN_PURPOSE_CODE_SYSTEM = "2.16.840.1.113883.3.18.7.1";
// See https://rce.sequoiaproject.org/wp-content/uploads/2025/08/SOP-Exchange-Purposes_GBD-Updates_508.pdf
export const NHIN_PURPOSE_CODE_SYSTEM_NEW = "2.16.840.1.113883.3.7204.1.5.2.1";

interface CodeMapping {
  fhirCode: string;
  nhinCode: string;
  display: string;
}

interface MappingResponse {
  system: string;
  code: string;
  display: string;
}

// The translation table based on your image and NHIN specs
const PURPOSE_MAP: CodeMapping[] = [
  { fhirCode: "TREAT", nhinCode: "TREATMENT", display: "Treatment" },
  { fhirCode: "HPAYMT", nhinCode: "PAYMENT", display: "Healthcare Payment" },
  { fhirCode: "HOPERAT", nhinCode: "OPERATIONS", display: "Healthcare Operations" },
  { fhirCode: "PUBHLTH", nhinCode: "PUBLICHEALTH", display: "Public Health" },
  { fhirCode: "SYSADMIN", nhinCode: "SYSADMIN", display: "System Administration" },
  { fhirCode: "ETREAT", nhinCode: "EMERGENCY", display: "Emergency Treatment" },
];

/**
 * Converts FHIR AuditEvent code (TREAT) to SAML/NHIN code (TREATMENT)
 */
export function mapFhirToNhinSaml(fhirCode: string): MappingResponse {
  const mapping = PURPOSE_MAP.find(m => m.fhirCode.toLowerCase() === fhirCode.toLowerCase());

  if (!mapping) {
    throw new MetriportError(`Unknown FHIR Purpose Code`, undefined, { fhirCode });
  }

  return {
    system: NHIN_PURPOSE_CODE_SYSTEM,
    code: mapping.nhinCode,
    display: mapping.display,
  };
}

/**
 * Converts Incoming SAML/NHIN code (TREATMENT) to FHIR AuditEvent (TREAT)
 */
export function mapNhinSamlToFhir(samlCode: string): MappingResponse {
  const mapping = PURPOSE_MAP.find(m => m.nhinCode.toLowerCase() === samlCode.toLowerCase());

  if (!mapping) {
    // Fallback: Use the raw code if we can't map it, but flag it
    return {
      system: FHIR_SYSTEM_URI,
      code: samlCode,
      display: "Unknown NHIN Code",
    };
  }

  return {
    system: FHIR_SYSTEM_URI,
    code: mapping.fhirCode,
    display: mapping.display,
  };
}

// TODO ENG-1601 Reconsider if we really need this
export function operationOutcomeToAuditEventEntity(
  operationOutcome: OperationOutcome
): AuditEventEntity {
  return {
    type: {
      system: "http://terminology.hl7.org/CodeSystem/audit-entity-type",
      code: "2",
      display: "System Object",
    },
    role: {
      system: "http://terminology.hl7.org/CodeSystem/object-role",
      code: "3",
      display: "Report",
    },
    detail: [
      {
        type: "OperationOutcome",
        valueString: stringToBase64(JSON.stringify(operationOutcome)),
      },
    ],
  };
}

export function getSubjectRoleFromSamlAttributes(samlAttributes: SamlAttributes): {
  code: string;
  display: string;
  system: string;
} {
  const inboundSubject = samlAttributes.subjectRole;
  const defaultSystem = defaultSubjectRole.system;
  return inboundSubject
    ? {
        ...inboundSubject,
        system: inboundSubject.system ?? defaultSystem,
      }
    : defaultSubjectRole;
}
