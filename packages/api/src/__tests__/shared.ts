export function isE2E(): boolean {
  return process.env.E2E === "true";
}
