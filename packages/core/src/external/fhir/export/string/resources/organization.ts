import { Organization } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAddresses } from "../shared/address";
import { formatCodings } from "../shared/coding";
import { formatNpiIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatTelecoms } from "../shared/telecom";

/**
 * Converts a FHIR Organization resource to a string representation
 */
export class OrganizationToString implements FHIRResourceToString<Organization> {
  toString(organization: Organization, isDebug?: boolean): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatNpiIdentifiers({ identifiers: organization.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (organization.name) parts.push(isDebug ? `Name: ${organization.name}` : organization.name);

    if (organization.alias) {
      const aliasStr = organization.alias.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Alias: ${aliasStr}` : aliasStr);
    }

    const telecoms = formatTelecoms({ telecoms: organization.telecom, isDebug });
    if (telecoms) parts.push(telecoms);

    const addresses = formatAddresses({
      addresses: organization.address,
      label: "Address",
      isDebug,
    });
    if (addresses) parts.push(addresses);

    const types = formatCodings({ codings: organization.type, label: "Type", isDebug });
    if (types) parts.push(types);

    return parts.join(FIELD_SEPARATOR);
  }
}
