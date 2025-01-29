import { normalizeState } from "@metriport/shared";
import { NetworkEntry } from "../../../domain/medical/network-entry";
import { HieDirectoryEntry } from "../../../external/hie/domain/hie-directory-entry";

export type NetworkEntryDTO = NetworkEntry;

export function dtoFromHieDirectoryEntry(networkEntry: HieDirectoryEntry): NetworkEntryDTO {
  return {
    id: networkEntry.id,
    name: networkEntry.name,
    oid: networkEntry.oid,
    zipCode: networkEntry.zipCode,
    state: networkEntry.state ? normalizeState(networkEntry.state) : undefined,
    rootOrganization: networkEntry.rootOrganization,
    managingOrgOid: networkEntry.managingOrganizationId,
  };
}
