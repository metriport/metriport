import { z } from "zod";
import { BadRequestError } from "../../error/bad-request";

export function normalizeStateSafe(state: string): USState | undefined {
  const trimmedState = state.trim();
  const keyFromEntries = Object.entries(states).find(
    ([key, value]) =>
      key.toLowerCase() === trimmedState.toLowerCase() ||
      value.toLowerCase() === trimmedState.toLowerCase()
  );
  return keyFromEntries?.[0] as USState | undefined;
}

export function normalizeState(state: string): USState {
  const stateOrUndefined = normalizeStateSafe(state);
  if (!stateOrUndefined) {
    throw new BadRequestError("Invalid state", undefined, { state });
  }
  return stateOrUndefined;
}

export enum USState {
  AL = "AL",
  AK = "AK",
  AZ = "AZ",
  AR = "AR",
  CA = "CA",
  CO = "CO",
  CT = "CT",
  DE = "DE",
  DC = "DC",
  FL = "FL",
  GA = "GA",
  HI = "HI",
  ID = "ID",
  IL = "IL",
  IN = "IN",
  IA = "IA",
  KS = "KS",
  KY = "KY",
  LA = "LA",
  ME = "ME",
  MD = "MD",
  MA = "MA",
  MI = "MI",
  MN = "MN",
  MS = "MS",
  MO = "MO",
  MT = "MT",
  NE = "NE",
  NV = "NV",
  NH = "NH",
  NJ = "NJ",
  NM = "NM",
  NY = "NY",
  NC = "NC",
  ND = "ND",
  OH = "OH",
  OK = "OK",
  OR = "OR",
  PA = "PA",
  RI = "RI",
  SC = "SC",
  SD = "SD",
  TN = "TN",
  TX = "TX",
  UT = "UT",
  VT = "VT",
  VA = "VA",
  WA = "WA",
  WV = "WV",
  WI = "WI",
  WY = "WY",
}

export const states: Record<USState, string> = {
  [USState.AZ]: "Arizona",
  [USState.AL]: "Alabama",
  [USState.AK]: "Alaska",
  [USState.AR]: "Arkansas",
  [USState.CA]: "California",
  [USState.CO]: "Colorado",
  [USState.CT]: "Connecticut",
  [USState.DE]: "Delaware",
  [USState.DC]: "District of Columbia",
  [USState.FL]: "Florida",
  [USState.GA]: "Georgia",
  [USState.HI]: "Hawaii",
  [USState.ID]: "Idaho",
  [USState.IL]: "Illinois",
  [USState.IN]: "Indiana",
  [USState.IA]: "Iowa",
  [USState.KS]: "Kansas",
  [USState.KY]: "Kentucky",
  [USState.LA]: "Louisiana",
  [USState.ME]: "Maine",
  [USState.MD]: "Maryland",
  [USState.MA]: "Massachusetts",
  [USState.MI]: "Michigan",
  [USState.MN]: "Minnesota",
  [USState.MS]: "Mississippi",
  [USState.MO]: "Missouri",
  [USState.MT]: "Montana",
  [USState.NE]: "Nebraska",
  [USState.NV]: "Nevada",
  [USState.NH]: "New Hampshire",
  [USState.NJ]: "New Jersey",
  [USState.NM]: "New Mexico",
  [USState.NY]: "New York",
  [USState.NC]: "North Carolina",
  [USState.ND]: "North Dakota",
  [USState.OH]: "Ohio",
  [USState.OK]: "Oklahoma",
  [USState.OR]: "Oregon",
  [USState.PA]: "Pennsylvania",
  [USState.RI]: "Rhode Island",
  [USState.SC]: "South Carolina",
  [USState.SD]: "South Dakota",
  [USState.TN]: "Tennessee",
  [USState.TX]: "Texas",
  [USState.UT]: "Utah",
  [USState.VT]: "Vermont",
  [USState.VA]: "Virginia",
  [USState.WA]: "Washington",
  [USState.WV]: "West Virginia",
  [USState.WI]: "Wisconsin",
  [USState.WY]: "Wyoming",
};

export const usStateSchema = z.preprocess(
  val => (typeof val === "string" ? val.toUpperCase().trim() : val),
  z.nativeEnum(USState)
);
