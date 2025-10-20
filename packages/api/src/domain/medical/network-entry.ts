import { USStateForAddress } from "@metriport/shared";

export interface NetworkEntry {
  id: string;
  oid: string;
  name: string;
  zipCode?: string;
  state?: USStateForAddress | undefined;
  managingOrgOid?: string;
  rootOrganization?: string;
  network: "COMMONWELL" | "CAREQUALITY";
}
