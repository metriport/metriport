import { genderMapperFromDomain } from "@metriport/shared/common/demographics";

// A Quest-assigned identifier for the patient roster
export const generalMnemonic = "METRIP";

// Quest does not support "O" (other), so we map it to "U" (unknown)
export const QuestGenderCodes = ["M", "F", "U"] as const;
export type QuestGenderCode = (typeof QuestGenderCodes)[number];

export const makeGenderDemographics = genderMapperFromDomain<QuestGenderCode>(
  {
    F: "F",
    M: "M",
    O: "U",
    U: "U",
  },
  "U"
);

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
