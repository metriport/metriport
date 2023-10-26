import { Cookie, CookieManager } from "./cookie-manager";

export class CookieManagerOnSecrets implements CookieManager {
  constructor(private readonly secretName: string) {}

  /**
   * Get Cookies from AWS SecretManager
   */
  async getCookies(): Promise<Cookie[]> {
    // TODO implement this
    // TODO implement this
    // TODO implement this
    // TODO implement this
    // TODO implement this
    this.secretName.split(",");
    return [];
  }

  /**
   * Store Cookies on AWS SecretManager
   */
  async updateCookies(cookies: Cookie[]) {
    // TODO implement this
    // TODO implement this
    // TODO implement this
    // TODO implement this
    // TODO implement this
    cookies.length;
  }
}
