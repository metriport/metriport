import { normalizeState } from "@metriport/shared";
import { Network } from "../../../domain/medical/network";
import { CQDirectoryEntry2 } from "../../../external/carequality/cq-directory";

export type NetworkDTO = Network;

export function dtoFromHieDirectoryEntry(network: CQDirectoryEntry2): NetworkDTO {
  return {
    name: network.name,
    oid: network.id,
    zip: network.zip,
    state: network.state ? normalizeState(network.state) : undefined,
    rootOrganization: network.rootOrganization,
    managingOrgOid: network.managingOrganizationId,
  };
}
