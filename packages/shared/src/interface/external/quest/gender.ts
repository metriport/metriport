export const QuestGenderCodes = ["M", "F", "U"] as const;
export type QuestGenderCode = (typeof QuestGenderCodes)[number];
