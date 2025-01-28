import { USState } from "@metriport/shared/dist/domain/address/state";

export interface NetworkEntry {
  name?: string;
  oid?: string;
  zipCode?: string;
  state?: USState;
  rootOrganization?: string;
  managingOrgOid?: string;
}
