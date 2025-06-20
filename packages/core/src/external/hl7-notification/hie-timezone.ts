export const hieTimezones = {
  HealthConnectTexas: "America/Chicago",
  Hixny: "America/New_York",
  HieTexasPcc: "America/Chicago",
  SacValleyMS: "America/Los_Angeles",
};

export function getHieTimezone(partnerName: string): string {
  return hieTimezones[partnerName as keyof typeof hieTimezones];
}
