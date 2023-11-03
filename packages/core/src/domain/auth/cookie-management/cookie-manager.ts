export type Cookie = {
  name: string;
  value: string;
};

export function cookieFromString(c: string): Cookie | undefined {
  const [name, value] = (c?.trim() ?? "").split("=");
  if (!name || !value) return undefined;
  return { name, value };
}
export function cookieToString(c: Cookie): string {
  return `${c.name}=${c.value}`;
}
export function cookiesToString(c: Cookie[]): string {
  return c.map(cookieToString).join("; ");
}

export abstract class CookieManager {
  abstract getCookies(): Promise<Cookie[]>;

  async getCookiesAsString(): Promise<string> {
    return cookiesToString(await this.getCookies());
  }

  abstract updateCookies(cookies: Cookie[]): Promise<Cookie[]>;
}
