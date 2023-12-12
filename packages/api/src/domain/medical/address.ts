import { USState } from "@metriport/core/domain/geographic-locations";
import { Coordinates } from "@metriport/core/external/aws/location";

export type Address = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: USState;
  zip: string;
  country?: string;
  coordinates?: Coordinates;
};

export function getState(address: Address): USState {
  return address.state;
}
