import { BadRequestError } from "../../error/bad-request";

export function normalizeTerritorySafe(territory: string): USTerritory | undefined {
  const keyFromEntries = Object.entries(territories).find(
    ([key, value]) => key === territory || value.toLowerCase() === territory.toLowerCase()
  );
  return keyFromEntries?.[0] as USTerritory | undefined;
}

export function normalizeTerritory(territory: string): USTerritory {
  const territoryOrUndefined = normalizeTerritorySafe(territory);
  if (!territoryOrUndefined)
    throw new BadRequestError("Invalid territory", undefined, { territory });
  return territoryOrUndefined;
}

export enum USTerritory {
  AS = "AS",
  GU = "GU",
  PR = "PR",
  VI = "VI",
}

const territories: Record<USTerritory, string> = {
  [USTerritory.AS]: "American Samoa",
  [USTerritory.GU]: "Guam",
  [USTerritory.PR]: "Puerto Rico",
  [USTerritory.VI]: "Virgin Islands",
};
