import { Practitioner, HumanName } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";

/**
 * Converts a FHIR Practitioner resource to a string representation
 */
export class PractitionerToString implements FHIRResourceToString<Practitioner> {
  toString(practitioner: Practitioner): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(practitioner.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add name
    if (practitioner.name) {
      const names = practitioner.name
        .map((name: HumanName) => {
          const given = name.given?.join(" ") ?? "";
          const family = name.family ?? "";
          return `${given} ${family}`.trim();
        })
        .join(FIELD_SEPARATOR);
      parts.push(`Name: ${names}`);
    }

    // Add telecom
    if (practitioner.telecom) {
      const telecoms = practitioner.telecom
        .map(t => `${t.system ?? "unknown"}: ${t.value}`)
        .join(FIELD_SEPARATOR);
      parts.push(`Contact: ${telecoms}`);
    }

    // Add address
    if (practitioner.address) {
      const addresses = practitioner.address
        .map(addr => {
          const components = [
            addr.line?.join(", "),
            addr.city,
            addr.state,
            addr.postalCode,
            addr.country,
          ].filter(Boolean);
          return components.join(", ");
        })
        .join(FIELD_SEPARATOR);
      parts.push(`Address: ${addresses}`);
    }

    // Add gender
    if (practitioner.gender) {
      parts.push(`Gender: ${practitioner.gender}`);
    }

    // Add birth date
    if (practitioner.birthDate) {
      parts.push(`DOB: ${practitioner.birthDate}`);
    }

    // Add qualification
    if (practitioner.qualification) {
      const qualifications = practitioner.qualification
        .map(q => {
          const parts: string[] = [];
          if (q.code) {
            const codes = q.code.coding?.map(c => c.display ?? c.code).join(FIELD_SEPARATOR) ?? "";
            parts.push(codes);
          }
          if (q.period) {
            const start = q.period.start ?? "unknown";
            const end = q.period.end ?? "ongoing";
            parts.push(`${start} to ${end}`);
          }
          if (q.issuer) {
            parts.push(`Issuer: ${q.issuer.display ?? q.issuer.reference}`);
          }
          return parts.join(FIELD_SEPARATOR);
        })
        .join(FIELD_SEPARATOR);
      parts.push(`Qualification: ${qualifications}`);
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
