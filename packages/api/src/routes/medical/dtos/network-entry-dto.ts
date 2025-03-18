import { normalizeUSStateForAddressSafe } from "@metriport/shared";
import { NetworkEntry } from "../../../domain/medical/network-entry";
import { HieDirectoryEntry } from "../../../external/hie/domain/hie-directory-entry";

export type NetworkEntryDTO = Omit<NetworkEntry, "id">;

export function dtoFromHieDirectoryEntry(networkEntry: HieDirectoryEntry): NetworkEntryDTO {
  return {
    name: networkEntry.name,
    oid: networkEntry.oid,
    zipCode: networkEntry.zipCode,
    state: normalizeUSStateForAddressSafe(networkEntry.state ?? ""),
    rootOrganization: networkEntry.rootOrganization,
    managingOrgOid: networkEntry.managingOrganizationId,
    network: networkEntry.network,
  };
}
