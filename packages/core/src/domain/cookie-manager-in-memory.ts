import { Cookie, CookieManager } from "./cookie-manager";

export class CookieManagerInMemory implements CookieManager {
  private cookies: Cookie[] = [];

  async getCookies(): Promise<Cookie[]> {
    return this.cookies;
  }
  async updateCookies(cookies: Cookie[]) {
    this.cookies = cookies;
  }
}
