export const QuestGenderCodes = ["F", "M", "U"] as const;

export type QuestGenderCode = (typeof QuestGenderCodes)[number];

export const GenderCodeMap: Record<QuestGenderCode, string> = {
  F: "female",
  M: "male",
  U: "unknown",
};

export enum RelationshipToSubscriber {
  Self = "01",
  Spouse = "02",
  Dependent = "08",
}

export const RelationshipToSubscriberCodes = [
  RelationshipToSubscriber.Self,
  RelationshipToSubscriber.Spouse,
  RelationshipToSubscriber.Dependent,
] as const;

export type RelationshipToSubscriberCode =
  (typeof RelationshipToSubscriber)[keyof typeof RelationshipToSubscriber];

export const RelationshipToSubscriberCodeName: Record<RelationshipToSubscriberCode, string> = {
  [RelationshipToSubscriber.Self]: "self",
  [RelationshipToSubscriber.Spouse]: "spouse",
  [RelationshipToSubscriber.Dependent]: "dependent/other",
};
