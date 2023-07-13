export const METRIC = "METRIC";
export const US_LOCALE = "en_US";

export enum FitbitCollectionTypes {
  activities = "activities",
  body = "body",
  foods = "foods",
  sleep = "sleep",
  userRevokedAccess = "userRevokedAccess",
}

export enum FitbitScopes {
  activity = "activity",
  nutrition = "nutrition",
  sleep = "sleep",
  weight = "weight",
}

export const fullSubscriptionRequiredScopes = [...Object.keys(FitbitScopes), "settings", "profile"];
