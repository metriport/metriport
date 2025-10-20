import { USStateForAddress } from "@metriport/shared/domain/address";

export interface NetworkEntry {
  name: string;
  oid: string;
  zip?: string;
  state?: USStateForAddress;
  rootOrganization?: string;
  managingOrgOid?: string;
  network: "COMMONWELL" | "CAREQUALITY";
}
