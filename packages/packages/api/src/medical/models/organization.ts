import { Address } from "./common/address";

export enum OrgType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
}
export interface Organization {
  id?: string | null;
  name: string;
  type: OrgType;
  locations: Address[];
}
