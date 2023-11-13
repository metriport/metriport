import { USState } from "@metriport/core/domain/geographic-locations";

export type Address = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: USState;
  zip: string;
  country?: string;
};
