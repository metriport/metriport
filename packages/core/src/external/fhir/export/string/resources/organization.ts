import { Organization } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAddresses } from "../shared/address";
import { formatIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Organization resource to a string representation
 */
export class OrganizationToString implements FHIRResourceToString<Organization> {
  toString(organization: Organization): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(organization.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (organization.name) {
      parts.push(`Name: ${organization.name}`);
    }

    if (organization.alias) {
      parts.push(`Alias: ${organization.alias.join(FIELD_SEPARATOR)}`);
    }

    if (organization.telecom) {
      const telecoms = organization.telecom
        .map(t => `${t.system ?? "unknown"}: ${t.value}`)
        .join(FIELD_SEPARATOR);
      parts.push(`Contact: ${telecoms}`);
    }

    if (organization.address) {
      const addresses = formatAddresses(organization.address, "Address");
      if (addresses) parts.push(addresses);
    }

    if (organization.type) {
      const types = organization.type
        .map(t => t.coding?.map(c => c.display ?? c.code).join(FIELD_SEPARATOR) ?? "")
        .join(FIELD_SEPARATOR);
      parts.push(`Type: ${types}`);
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
