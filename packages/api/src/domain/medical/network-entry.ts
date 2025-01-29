import { USState } from "@metriport/shared/dist/domain/address/state";

export interface NetworkEntry {
  id: string;
  oid: string;
  name?: string;
  zipCode?: string;
  state?: USState;
  rootOrganization?: string;
  managingOrgOid?: string;
}
