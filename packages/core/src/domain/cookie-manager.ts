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

export class CookieManager {
  private cookies: Cookie[] = [];

  /**
   * Get Cookies from DynamoDB
   */
  async getCookies(): Promise<Cookie[]> {
    return this.cookies;
  }

  /**
   * Store Cookies on DynamoDB
   */
  async updateCookies(cookies: Cookie[]) {
    this.cookies = cookies;
  }
}
