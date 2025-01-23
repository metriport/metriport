import { normalizeState } from "@metriport/shared";
import { NetworkEntry } from "../../../domain/medical/network-entry";
import { CQDirectoryEntry2 } from "../../../external/carequality/cq-directory";

export type NetworkEntryDTO = NetworkEntry;

export function dtoFromHieDirectoryEntry(networkEntry: CQDirectoryEntry2): NetworkEntryDTO {
  return {
    name: networkEntry.name,
    oid: networkEntry.id,
    zip: networkEntry.zip,
    state: networkEntry.state ? normalizeState(networkEntry.state) : undefined,
    rootOrganization: networkEntry.rootOrganization,
    managingOrgOid: networkEntry.managingOrganizationId,
  };
}
