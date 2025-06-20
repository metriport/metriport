export const hieTimezones = {
  HealthConnectTexas: "America/Chicago",
  Hixny: "America/New_York",
  HieTexasPcc: "America/Chicago",
  SacValleyMS: "America/Los_Angeles",
};

/**
 * Returns the timezone for a given HIE partner.
 * If the partner is not found, returns UTC.
 *
 * @param partnerName - The name of the HIE partner.
 * @returns The timezone for the HIE partner.
 */
export function getHieTimezone(partnerName: string): string {
  return hieTimezones[partnerName as keyof typeof hieTimezones] ?? "UTC";
}
