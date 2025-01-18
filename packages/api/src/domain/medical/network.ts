import { USState } from "@metriport/shared/dist/domain/address/state";

export interface Network {
  name?: string;
  oid?: string;
  zip?: string;
  state?: USState;
  managingOrg?: string;
  managingOrgOid?: string;
}
