import { Organization } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";

/**
 * Converts a FHIR Organization resource to a string representation
 */
export class OrganizationToString implements FHIRResourceToString<Organization> {
  toString(organization: Organization): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(organization.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add name
    if (organization.name) {
      parts.push(`Name: ${organization.name}`);
    }

    // Add alias
    if (organization.alias) {
      parts.push(`Alias: ${organization.alias.join(FIELD_SEPARATOR)}`);
    }

    // Add telecom
    if (organization.telecom) {
      const telecoms = organization.telecom
        .map(t => `${t.system ?? "unknown"}: ${t.value}`)
        .join(FIELD_SEPARATOR);
      parts.push(`Contact: ${telecoms}`);
    }

    // Add address
    if (organization.address) {
      const addresses = organization.address
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

    // Add type
    if (organization.type) {
      const types = organization.type
        .map(t => t.coding?.map(c => c.display ?? c.code).join(FIELD_SEPARATOR) ?? "")
        .join(FIELD_SEPARATOR);
      parts.push(`Type: ${types}`);
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
