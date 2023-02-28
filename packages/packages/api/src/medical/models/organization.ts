import { Address } from "./common/address";

export interface Organization {
  id?: string | null;
  name: string;
  type?: string | null;
  locations: Address[];
}
