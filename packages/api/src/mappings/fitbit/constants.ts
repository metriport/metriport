export const METRIC = "METRIC";
export const US_LOCALE = "en_US";

export const fitbitCollectionTypes = [
  "activities",
  "body",
  "sleep",
  "foods",
  "userRevokedAccess",
] as const;
export type FitbitCollectionTypes = (typeof fitbitCollectionTypes)[number];

// temporary collection until userRevokedAccess is implemented
export type FitbitCollectionTypesWithoutUserRevokedAccess = Exclude<
  FitbitCollectionTypes,
  "userRevokedAccess"
>;

// scopes defined in the authorization form while connecting to Fitbit. Note that these don't exactly match the collectionTypes.
export enum FitbitScopes {
  activity = "activity",
  nutrition = "nutrition",
  sleep = "sleep",
  weight = "weight",
}

export const fullSubscriptionRequiredScopes = [...Object.keys(FitbitScopes), "settings", "profile"];
