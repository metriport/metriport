export function buildLbAccessLogPrefix(prefix: string): string {
  return `load-balancers/access-logs/${prefix}`;
}
