import { USStateForAddress } from "@metriport/shared/dist/domain/address";

export interface NetworkEntry {
  name: string;
  oid: string;
  zip: string | undefined;
  state: USStateForAddress | undefined;
  rootOrganization: string | undefined;
  managingOrgOid: string | undefined;
}
