import axios, { AxiosInstance } from "axios";
import { Activity } from "../models/activity";
import { Biometrics } from "../models/biometrics";
import { Body } from "../models/body";
import { Nutrition } from "../models/nutrition";
import { Sleep } from "../models/sleep";
import { User } from "../models/user";
import { dateIsValid } from "./util/date-util";
import { GetConnectTokenResponse } from "./models/get-connect-token-response";
import { GetMetriportUserIDResponse } from "./models/get-metriport-user-id-response";

export class Metriport {
  private api: AxiosInstance;

  /**
   * Creates a new instance of the Metriport API client.
   *
   * @param {string} apiKey - Your Metriport API key.
   */
  constructor(apiKey: string) {
    this.api = axios.create({
      baseURL: "https://api.metriport.com",
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
    const resp = await this.api.post<GetMetriportUserIDResponse>(
      "/user",
      null,
      {
        params: { appUserId: appUserId },
      }
    );
    return resp.data.userId;
  }

  /**
   * For the given user ID, get a token to be used for a Metriport Connect session.
   *
   * @param {string} userId - The user ID of the user that will be using the Connect widget.
   * @returns The Metriport Connect session token.
   */
  async getConnectToken(userId: string): Promise<string> {
    const resp = await this.api.get<GetConnectTokenResponse>(
      "/user/connect/token",
      {
        params: { userId: userId },
      }
    );
    return resp.data.token;
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
}
