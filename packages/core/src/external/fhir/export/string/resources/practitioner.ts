import { Practitioner } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAddresses } from "../shared/address";
import { formatHumanNames } from "../shared/human-name";
import { formatIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatTelecoms } from "../shared/telecom";

/**
 * Converts a FHIR Practitioner resource to a string representation
 */
export class PractitionerToString implements FHIRResourceToString<Practitioner> {
  toString(practitioner: Practitioner): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(practitioner.identifier);
    if (identifierStr) parts.push(identifierStr);

    const names = formatHumanNames(practitioner.name);
    if (names) parts.push(names);

    const telecoms = formatTelecoms(practitioner.telecom, "Contact");
    if (telecoms) parts.push(telecoms);

    const addresses = formatAddresses(practitioner.address, "Address");
    if (addresses) parts.push(addresses);

    if (practitioner.gender) parts.push(`Gender: ${practitioner.gender}`);

    if (practitioner.birthDate) parts.push(`DOB: ${practitioner.birthDate}`);

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
