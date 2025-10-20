import { Location } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAddress } from "../shared/address";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatReference } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatTelecoms } from "../shared/telecom";

/**
 * Converts a FHIR Location resource to a string representation
 */
export class LocationToString implements FHIRResourceToString<Location> {
  toString(location: Location, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: location.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (location.status) {
      parts.push(isDebug ? `Status: ${location.status}` : location.status);
    }

    if (location.name) {
      parts.push(isDebug ? `Name: ${location.name}` : location.name);
      hasMinimumData = true;
    }

    if (location.alias) {
      parts.push(
        isDebug
          ? `Aliases: ${location.alias.join(FIELD_SEPARATOR)}`
          : location.alias.join(FIELD_SEPARATOR)
      );
      hasMinimumData = true;
    }

    if (location.description) {
      parts.push(isDebug ? `Description: ${location.description}` : location.description);
      hasMinimumData = true;
    }

    const typeStr = formatCodeableConcepts({ concepts: location.type, label: "Type", isDebug });
    if (typeStr) parts.push(typeStr);

    const telecoms = formatTelecoms({ telecoms: location.telecom, label: "Telecom", isDebug });
    if (telecoms) parts.push(telecoms);

    const addresses = formatAddress({ address: location.address, isDebug });
    if (addresses) {
      parts.push(addresses);
      hasMinimumData = true;
    }

    const physicalTypeStr = formatCodeableConcept({
      concept: location.physicalType,
      label: "Physical Type",
      isDebug,
    });
    if (physicalTypeStr) parts.push(physicalTypeStr);

    const orgStr = formatReference({
      reference: location.managingOrganization,
      label: "Organization",
      isDebug,
    });
    if (orgStr) parts.push(orgStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
