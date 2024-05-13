/**
 * Does not take into account subdomains (i.e. john@support.metriport.com)
 */
export function getDomainFromEmailWithoutTld(email?: string): string | undefined {
  if (!email) {
    return;
  }
  return email.split("@")[1]?.split(".")[0];
}
