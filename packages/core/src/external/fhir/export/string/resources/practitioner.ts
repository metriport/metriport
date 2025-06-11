import { Practitioner } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAddresses } from "../shared/address";
import { formatCodeableConcept } from "../shared/codeable-concept";
import { formatHumanNames } from "../shared/human-name";
import { formatNpiIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatTelecoms } from "../shared/telecom";

/**
 * Converts a FHIR Practitioner resource to a string representation
 */
export class PractitionerToString implements FHIRResourceToString<Practitioner> {
  toString(practitioner: Practitioner, isDebug?: boolean): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatNpiIdentifiers({ identifiers: practitioner.identifier });
    if (identifierStr) parts.push(identifierStr);

    const names = formatHumanNames({ names: practitioner.name, isDebug });
    if (names) parts.push(names);

    const telecoms = formatTelecoms({ telecoms: practitioner.telecom, label: "Contact", isDebug });
    if (telecoms) parts.push(telecoms);

    const addresses = formatAddresses({
      addresses: practitioner.address,
      label: "Address",
      isDebug,
    });
    if (addresses) parts.push(addresses);

    if (practitioner.gender) {
      parts.push(isDebug ? `Gender: ${practitioner.gender}` : practitioner.gender);
    }

    if (practitioner.birthDate) {
      parts.push(isDebug ? `DOB: ${practitioner.birthDate}` : practitioner.birthDate);
    }

    const qualifications = practitioner.qualification?.map(q => {
      const parts: string[] = [];
      const codes = formatCodeableConcept({ concept: q.code, isDebug });
      if (codes) parts.push(codes);
      // const period = formatPeriod(q.period);
      // if (period) parts.push(period);
      // const issuer = formatReference(q.issuer, "Issuer");
      // if (issuer) parts.push(issuer);
      return parts.join(FIELD_SEPARATOR);
    });
    if (qualifications && qualifications.length > 0) {
      const joined = qualifications.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Qualification: ${joined}` : joined);
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
