import axios, { AxiosInstance } from "axios";
import { Activity } from "../models/activity";
import { Biometrics } from "../models/biometrics";
import { Body } from "../models/body";
import { Nutrition } from "../models/nutrition";
import { Sleep } from "../models/sleep";
import { User } from "../models/user";
import { ProviderSource } from "../models/common/provider-source";
import { dateIsValid } from "./util/date-util";
import { GetConnectTokenResponse } from "./models/get-connect-token-response";
import { GetMetriportUserIDResponse } from "./models/get-metriport-user-id-response";
import { SettingsResponse } from "./models/settings-response";
import { WebhookStatusResponse } from "./models/webhook-status-response";

export class Metriport {
  private api: AxiosInstance;

  /**
   * Creates a new instance of the Metriport API client.
   *
   * @param {string} apiKey - Your Metriport API key.
   */
  constructor(apiKey: string, baseURL = "https://api.metriport.com") {
    this.api = axios.create({
      baseURL,
      headers: { "x-api-key": apiKey },
    });
  }

  /**
   * For your given user ID, returns the Metriport user ID used for identifying
   * the user and making subsequent calls for the user's data.
   *
   * @param {string} appUserId - The unique ID for the user in your app.
   * @returns The userId of the user.
   */
  async getMetriportUserId(appUserId: string): Promise<string> {
    const resp = await this.api.post<GetMetriportUserIDResponse>("/user", null, {
      params: { appUserId: appUserId },
    });
    return resp.data.userId;
  }

  /**
   * For your given user ID, returns the user's connected providers
   *
   * @param {string} userId - The unique ID for the user in your app.
   * @returns Object containing array of connected providers.
   */
  async getConnectedProviders(userId: string): Promise<{ connectedProviders: string[] }> {
    const resp = await this.api.get<{ connectedProviders: string[] }>(
      `/user/${userId}/connected-providers`
    );

    return resp.data;
  }

  /**
   * For the given user ID, get a token to be used for a Metriport Connect session.
   *
   * @param {string} userId - The user ID of the user that will be using the Connect widget.
   * @returns The Metriport Connect session token.
   */
  async getConnectToken(userId: string): Promise<string> {
    const resp = await this.api.get<GetConnectTokenResponse>("/user/connect/token", {
      params: { userId: userId },
    });
    return resp.data.token;
  }

  /**
   * For the given user ID, revoke the user's access to the specified provider.
   *
   * @param {string}          userId    - The user ID of the user for which to revoke access.
   * @param {ProviderSource}  provider  - The data provider to revoke access to.
   * @returns void.
   */
  async revokeUserAccessToProvider(userId: string, provider: ProviderSource): Promise<void> {
    await this.api.delete("/user/revoke", {
      params: { userId: userId, provider: provider.toString() },
    });
  }

  /**
   * Gets the activity info for the specified user ID and date.
   *
   * @param {string} userId - The userId of the user you want to get data for.
   * @param {string} date - The date you want to get the data for (YYYY-MM-DD).
   * @returns An array of activity data from each connected provider.
   */
  async getActivityData(userId: string, date: string): Promise<Activity[]> {
    const resp = await this.api.get<Activity[]>("/activity", {
      params: this.validateAndBuildParams(userId, date),
    });
    return resp.data;
  }

  /**
   * Gets the body data for the specified user ID and date.
   *
   * @param {string} userId - The userId of the user you want to get data for.
   * @param {string} date - The date you want to get the data for (YYYY-MM-DD).
   * @returns An array of body data from each connected provider.
   */
  async getBodyData(userId: string, date: string): Promise<Body[]> {
    const resp = await this.api.get<Body[]>("/body", {
      params: this.validateAndBuildParams(userId, date),
    });
    return resp.data;
  }

  /**
   * Gets the biometrics data for the specified user ID and date.
   *
   * @param {string} userId - The userId of the user you want to get data for.
   * @param {string} date - The date you want to get the data for (YYYY-MM-DD).
   * @returns An array of biometrics data from each connected provider.
   */
  async getBiometricsData(userId: string, date: string): Promise<Biometrics[]> {
    const resp = await this.api.get<Biometrics[]>("/biometrics", {
      params: this.validateAndBuildParams(userId, date),
    });
    return resp.data;
  }

  /**
   * Gets the nutrition data for the specified user ID and date.
   *
   * @param {string} userId - The userId of the user you want to get data for.
   * @param {string} date - The date you want to get the data for (YYYY-MM-DD).
   * @returns An array of nutrition data from each connected provider.
   */
  async getNutritionData(userId: string, date: string): Promise<Nutrition[]> {
    const resp = await this.api.get<Nutrition[]>("/nutrition", {
      params: this.validateAndBuildParams(userId, date),
    });
    return resp.data;
  }

  /**
   * Gets the sleep data for the specified user ID and date.
   *
   * @param {string} userId - The userId of the user you want to get data for.
   * @param {string} date - The date you want to get the data for (YYYY-MM-DD).
   * @returns An array of sleep data from each connected provider.
   */
  async getSleepData(userId: string, date: string): Promise<Sleep[]> {
    const resp = await this.api.get<Sleep[]>("/sleep", {
      params: this.validateAndBuildParams(userId, date),
    });
    return resp.data;
  }

  /**
   * Gets the user info for the specified user ID and date.
   *
   * @param {string} userId - The userId of the user you want to get data for.
   * @param {string} date - The date you want to get the data for (YYYY-MM-DD).
   * @returns An array of user data from each connected provider.
   */
  async getUserData(userId: string, date: string): Promise<User[]> {
    const resp = await this.api.get<User[]>("/user", {
      params: this.validateAndBuildParams(userId, date),
    });
    return resp.data;
  }

  /**
   * If the userId is empty or the date is not in the correct format, throw an error. Otherwise, return
   * an object with the userId and date.
   *
   * @param {string} userId - The userId of the user you want to get the data for.
   * @param {string} date - The date to get the user's schedule for.
   * @returns an object with the userId and date properties.
   */
  private validateAndBuildParams(userId: string, date: string) {
    if (userId.trim().length < 1) throw Error(`userId must not be empty!`);
    if (!dateIsValid(date)) throw Error(`date must be in format YYYY-MM-DD!`);
    return { userId, date };
  }

  /**
   * Gets the settings for your account.
   *
   * @returns Your account settings.
   */
  async getSettings(): Promise<SettingsResponse> {
    const resp = await this.api.get<SettingsResponse>("/settings");
    return resp.data;
  }

  /**
   * Update the settings for your account.
   *
   * @returns Your updated account settings.
   */
  async updateSettings(webhookUrl: string): Promise<SettingsResponse> {
    const resp = await this.api.post<SettingsResponse>("/settings", {
      webhookUrl,
    });
    return resp.data;
  }

  /**
   * Gets the status of communication with your app's webhook.
   *
   * @returns The status of communication with your app's webhook.
   */
  async getWebhookStatus(): Promise<WebhookStatusResponse> {
    const resp = await this.api.get<WebhookStatusResponse>("/settings/webhook");
    return resp.data;
  }

  /**
   * Retries failed webhook requests.
   *
   * @returns void
   */
  async retryWebhookRequests(): Promise<void> {
    await this.api.post("/settings/webhook/retry");
  }
}
