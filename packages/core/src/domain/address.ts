import {
  defaultOptionalStringSchema,
  defaultZipStringSchema,
  USStateForAddress,
} from "@metriport/shared";
import { uniqBy } from "lodash";
import { usStateForAddressSchema } from "@metriport/api-sdk";
import { z } from "zod";

export type Coordinates = {
  lat: number;
  lon: number;
};

export type Address = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: USStateForAddress;
  zip: string;
  country?: string;
  coordinates?: Coordinates;
};

export function getState(address: Address): USStateForAddress {
  return address.state;
}

export function combineAddresses(addressList1: Address[], addressList2: Address[]): Address[] {
  const combined = [...addressList1, ...addressList2];

  function compareAddresses(a: Address, b: Address): number {
    const aHasCoordinates = a.coordinates ? 1 : 0;
    const bHasCoordinates = b.coordinates ? 1 : 0;
    return bHasCoordinates - aHasCoordinates;
  }
  combined.sort(compareAddresses);

  return uniqBy(combined, a => `${a.addressLine1}-${a.addressLine2}-${a.city}-${a.state}-${a.zip}`);
}

export const addressStrictSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: defaultOptionalStringSchema,
  city: z.string().min(1),
  state: usStateForAddressSchema,
  zip: defaultZipStringSchema,
  country: z.literal("USA").default("USA"),
});

export const ADDRESS_ABBREVIATIONS: { [key: string]: string } = {
  dr: "drive",
  st: "street",
  ave: "avenue",
  blvd: "boulevard",
  rd: "road",
  ln: "lane",
  ct: "court",
  pl: "place",
  cir: "circle",
  way: "way",
  hwy: "highway",
  pkwy: "parkway",
  sq: "square",
  ter: "terrace",
  apt: "apartment",
  ste: "suite",
  unit: "unit",
  fl: "floor",
  rm: "room",
};

export const DIRECTION_ABBREVIATIONS: { [key: string]: string } = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  ne: "northeast",
  nw: "northwest",
  se: "southeast",
  sw: "southwest",
};
