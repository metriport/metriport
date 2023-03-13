import { Address } from "./common/address";

export interface Patient {
  id?: string | null;
  facilityIds?: Array<string>[] | null;
  firstName: string;
  lastName: string;
  dob: string;
  address: Address;
  contact: {
    phone?: string;
    email?: string;
  };
}
