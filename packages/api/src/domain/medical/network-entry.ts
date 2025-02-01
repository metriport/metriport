import { USStateForAddress } from "@metriport/shared";

export interface NetworkEntry {
  id: string;
  oid: string;
  name: string;
  state: USStateForAddress | undefined;
  zipCode: string | undefined;
  managingOrgOid: string | undefined;
  rootOrganization: string | undefined;
}
