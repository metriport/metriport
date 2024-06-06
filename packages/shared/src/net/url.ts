export function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}
