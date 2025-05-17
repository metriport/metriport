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
  toString(location: Location): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    if (location.identifier) {
      const identifierStr = formatIdentifiers(location.identifier);
      if (identifierStr) parts.push(identifierStr);
    }

    if (location.status) {
      parts.push(`Status: ${location.status}`);
    }

    if (location.name) {
      parts.push(`Name: ${location.name}`);
      hasMinimumData = true;
    }

    if (location.alias) {
      parts.push(`Aliases: ${location.alias.join(FIELD_SEPARATOR)}`);
      hasMinimumData = true;
    }

    if (location.description) {
      parts.push(`Description: ${location.description}`);
      hasMinimumData = true;
    }

    if (location.type) {
      const typeStr = formatCodeableConcepts(location.type, "Type");
      if (typeStr) parts.push(typeStr);
    }

    const telecoms = formatTelecoms(location.telecom, "Telecom");
    if (telecoms) {
      parts.push(telecoms);
      // hasMinimumData = true;
    }

    const addresses = formatAddress(location.address);
    if (addresses) {
      parts.push(addresses);
      hasMinimumData = true;
    }

    const physicalTypeStr = formatCodeableConcept(location.physicalType, "Physical Type");
    if (physicalTypeStr) parts.push(physicalTypeStr);

    const orgStr = formatReference(location.managingOrganization, "Organization");
    if (orgStr) parts.push(orgStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
