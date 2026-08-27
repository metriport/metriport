import { z } from "zod";

export const QuestRosterType = {
  NOTIFICATIONS: "notifications",
  BACKFILL: "backfill",
} as const;

export type QuestRosterType = (typeof QuestRosterType)[keyof typeof QuestRosterType];

export const questRosterTypeSchema = z.enum([
  QuestRosterType.NOTIFICATIONS,
  QuestRosterType.BACKFILL,
]);

export function isValidQuestRosterType(value: string): value is QuestRosterType {
  return questRosterTypeSchema.safeParse(value).success;
}

export function validateQuestRosterType(value: string): QuestRosterType {
  return questRosterTypeSchema.parse(value);
}

export function isBackfillRosterType(rosterType: QuestRosterType): boolean {
  return rosterType === QuestRosterType.BACKFILL;
}

export function isNotificationRosterType(rosterType: QuestRosterType): boolean {
  return rosterType === QuestRosterType.NOTIFICATIONS;
}

export const questRosterMetadataSchema = z.object({
  dateId: z.string().optional(),
});

export type QuestRosterMetadata = z.infer<typeof questRosterMetadataSchema>;

export function getQuestRosterMetadata(data: unknown): QuestRosterMetadata | undefined {
  const result = questRosterMetadataSchema.safeParse(data);
  if (!result.success) return undefined;
  return result.data;
}
