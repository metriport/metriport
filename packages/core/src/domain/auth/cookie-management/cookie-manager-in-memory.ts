import { Cookie, CookieManager } from "./cookie-manager";

export class CookieManagerInMemory extends CookieManager {
  private cookies: Cookie[] = [];

  async getCookies(): Promise<Cookie[]> {
    return this.cookies;
  }
  async updateCookies(cookies: Cookie[]) {
    this.cookies = cookies;
    return this.cookies;
  }
}
