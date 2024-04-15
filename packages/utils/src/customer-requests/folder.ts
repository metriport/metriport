export function getFolderNameForOrg(orgName: string): string {
  return `${orgName?.replace(/[,.]/g, "").replaceAll(" ", "-")}_${new Date().toISOString()}`;
}
