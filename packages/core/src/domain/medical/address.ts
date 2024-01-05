import { USState } from "../geographic-locations";

export type Address = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: USState;
  zip: string;
  country?: string;
};

export function getState(address: Address): USState {
  return address.state;
}
