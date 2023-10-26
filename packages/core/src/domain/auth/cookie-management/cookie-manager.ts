export type Cookie = {
  name: string;
  value: string;
};

export function cookieFromString(c: string): Cookie | undefined {
  const [name, value] = c.split("=");
  if (!name || !value) return undefined;
  return { name, value };
}
export function cookieToString(c: Cookie): string {
  return `${c.name}=${c.value}`;
}
export function cookiesToString(c: Cookie[]): string {
  return c.map(cookieToString).join("; ");
}

export interface CookieManager {
  getCookies(): Promise<Cookie[]>;
  updateCookies(cookies: Cookie[]): Promise<Cookie[]>;
}
