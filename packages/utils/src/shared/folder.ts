export function getFileNameForOrg(orgName: string, extension?: string): string {
  const ext = extension ? `.${extension}` : "";
  return `${orgName?.replace(/[,.]/g, "").replaceAll(" ", "-")}_${new Date().toISOString()}${ext}`;
}
