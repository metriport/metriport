import { USState } from "@metriport/api-sdk";

export function normalizeState(state: string): USState | undefined {
  if (Object.values(states).includes(USState[state as keyof typeof USState])) {
    return USState[state as keyof typeof USState];
  } else if (states[state]) {
    return states[state];
  } else if (state === "DC") {
    return USState.DC;
  }
  return undefined;
}

export function normalizeStateStrict(state: string): USState {
  const stateOrUndefined = normalizeState(state);
  if (!stateOrUndefined) throw new Error("Invalid state.");
  return stateOrUndefined;
}

const states: { [k in string]: USState } = {
  Arizona: USState.AZ,
  Alabama: USState.AL,
  Alaska: USState.AK,
  Arkansas: USState.AR,
  California: USState.CA,
  Colorado: USState.CO,
  Connecticut: USState.CT,
  Delaware: USState.DE,
  Florida: USState.FL,
  Georgia: USState.GA,
  Hawaii: USState.HI,
  Idaho: USState.ID,
  Illinois: USState.IL,
  Indiana: USState.IN,
  Iowa: USState.IA,
  Kansas: USState.KS,
  Kentucky: USState.KY,
  Louisiana: USState.LA,
  Maine: USState.ME,
  Maryland: USState.MD,
  Massachusetts: USState.MA,
  Michigan: USState.MI,
  Minnesota: USState.MN,
  Mississippi: USState.MS,
  Missouri: USState.MO,
  Montana: USState.MT,
  Nebraska: USState.NE,
  Nevada: USState.NV,
  "New Hampshire": USState.NH,
  "New Jersey": USState.NJ,
  "New Mexico": USState.NM,
  "New York": USState.NY,
  "North Carolina": USState.NC,
  "North Dakota": USState.ND,
  Ohio: USState.OH,
  Oklahoma: USState.OK,
  Oregon: USState.OR,
  Pennsylvania: USState.PA,
  "Rhode Island": USState.RI,
  "South Carolina": USState.SC,
  "South Dakota": USState.SD,
  Tennessee: USState.TN,
  Texas: USState.TX,
  Utah: USState.UT,
  Vermont: USState.VT,
  Virginia: USState.VA,
  Washington: USState.WA,
  "West Virginia": USState.WV,
  Wisconsin: USState.WI,
  Wyoming: USState.WY,
};
