import * as AWS from "aws-sdk";
import { MetriportError } from "../../../util/error/metriport-error";
import { Cookie, CookieManager } from "./cookie-manager";

export class CookieManagerOnSecrets implements CookieManager {
  private readonly secretManager: AWS.SecretsManager;

  constructor(private readonly secretArn: string, region: string) {
    this.secretManager = new AWS.SecretsManager({ region });
  }

  /**
   * Get Cookies from AWS SecretManager
   */
  async getCookies(): Promise<Cookie[]> {
    const appSecret = await this.secretManager
      .getSecretValue({ SecretId: this.secretArn })
      .promise();
    const secretAsString = appSecret.SecretString;
    if (!secretAsString) {
      throw new MetriportError(`Secret is empty`, undefined, { secretArn: this.secretArn });
    }
    const cookies = JSON.parse(secretAsString) as Cookie[];
    return cookies;
  }

  /**
   * Store Cookies on AWS SecretManager
   */
  async updateCookies(cookies: Cookie[]): Promise<Cookie[]> {
    if (!cookies) return [];
    const cookiesAsString = JSON.stringify(cookies);
    await this.secretManager
      .updateSecret({ SecretId: this.secretArn, SecretString: cookiesAsString })
      .promise();
    return cookies;
  }
}
