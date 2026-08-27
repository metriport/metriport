import { z } from "zod";

export const SurescriptsRosterType = {
  NOTIFICATIONS: "notifications",
  BACKFILL: "backfill",
} as const;

export type SurescriptsRosterType =
  (typeof SurescriptsRosterType)[keyof typeof SurescriptsRosterType];

export const surescriptsRosterTypeSchema = z.enum([
  SurescriptsRosterType.NOTIFICATIONS,
  SurescriptsRosterType.BACKFILL,
]);

export function isValidSurescriptsRosterType(value: string): value is SurescriptsRosterType {
  return surescriptsRosterTypeSchema.safeParse(value).success;
}

export function validateSurescriptsRosterType(value: string): SurescriptsRosterType {
  return surescriptsRosterTypeSchema.parse(value);
}

export function isNotificationRosterType(rosterType: SurescriptsRosterType): boolean {
  return rosterType === SurescriptsRosterType.NOTIFICATIONS;
}

export function isBackfillRosterType(rosterType: SurescriptsRosterType): boolean {
  return rosterType === SurescriptsRosterType.BACKFILL;
}
