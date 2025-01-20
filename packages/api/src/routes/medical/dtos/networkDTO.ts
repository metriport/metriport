import { normalizeState } from "@metriport/shared";
import { Network } from "../../../domain/medical/network";
import { CQDirectoryEntry2 } from "../../../external/carequality/cq-directory";
import { BaseDTO } from "./baseDTO";

export type NetworkDTO = BaseDTO & Network;

export function dtoFromHieDirectoryEntry(network: CQDirectoryEntry2): NetworkDTO {
  return {
    id: network.id,
    eTag: "1",
    name: network.name,
    oid: network.id,
    zip: network.zip,
    state: network.state ? normalizeState(network.state) : undefined,
    managingOrg: network.data?.name,
    managingOrgOid: network.managingOrganizationId,
  };
}
