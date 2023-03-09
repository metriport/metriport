import { Activity, Biometrics, Body, Nutrition, Sleep } from "@metriport/api";
import axios from "axios";
import dayjs from "dayjs";

import { PROVIDER_GOOGLE } from "../shared/constants";
import { OAuth2, OAuth2DefaultImpl } from "./oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";
import { Config } from "../shared/config";
import { ConnectedUser } from "../models/connected-user";
import { mapToActivity } from "../mappings/google/activity";
import { googleActivityResp } from "../mappings/google/models/activity";
import { mapToBody } from "../mappings/google/body";
import { googleBodyResp } from "../mappings/google/models/body";
import { mapToBiometrics } from "../mappings/google/biometrics";
import { googleBiometricsResp } from "../mappings/google/models/biometrics";
import { mapToNutrition } from "../mappings/google/nutrition";
import { googleNutritionResp } from "../mappings/google/models/nutrition";
import { mapToSleep } from "../mappings/google/sleep";
import { googleSleepResp } from "../mappings/google/models/sleep";

export class Google extends Provider implements OAuth2 {
  static URL = "https://www.googleapis.com";
  static AUTHORIZATION_URL = "https://accounts.google.com";
  static TOKEN_HOST = "https://oauth2.googleapis.com";
  static AUTHORIZATION_PATH = "/o/oauth2/v2/auth";
  static TOKEN_PATH = "/token";
  static API_PATH = "/fitness/v1";
  static scopes = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.blood_glucose.read",
    "https://www.googleapis.com/auth/fitness.blood_pressure.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.body_temperature.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.location.read",
    "https://www.googleapis.com/auth/fitness.nutrition.read",
    "https://www.googleapis.com/auth/fitness.oxygen_saturation.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
  ];

  private static clientId = Config.getGoogleClientId();
  private static clientSecret = Config.getGoogleClientSecret();

  constructor(
    private readonly oauth = new OAuth2DefaultImpl(
      PROVIDER_GOOGLE,
      Google.clientId,
      Google.clientSecret,
      {
        authorizeHost: Google.AUTHORIZATION_URL,
        tokenHost: Google.TOKEN_HOST,
        authorizePath: Google.AUTHORIZATION_PATH,
        tokenPath: Google.TOKEN_PATH,
      },
      Google.scopes
    )
  ) {
    super({
      [ConsumerHealthDataType.Activity]: true,
      [ConsumerHealthDataType.Body]: true,
      [ConsumerHealthDataType.Biometrics]: true,
      [ConsumerHealthDataType.Nutrition]: true,
      [ConsumerHealthDataType.Sleep]: true,
      [ConsumerHealthDataType.User]: false,
    });
  }

  async getAuthUri(state: string): Promise<string> {
    return this.oauth.getAuthUri(state);
  }

  async getTokenFromAuthCode(code: string): Promise<string> {
    return this.oauth.getTokenFromAuthCode(code);
  }

  async revokeProviderAccess(connectedUser: ConnectedUser) {
    try {
      await this.oauth.revokeLocal(connectedUser);
    } catch (error) {
      throw new Error("Google Revoke failed");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetchGoogleData(connectedUser: ConnectedUser, date: string, options: any) {
    try {
      const access_token = await this.oauth.getAccessToken(connectedUser);

      const resp = await axios.post(
        `${Google.URL}${Google.API_PATH}/users/me/dataset:aggregate`,
        {
          startTimeMillis: dayjs(date).valueOf(),
          endTimeMillis: dayjs(date).add(24, "hours").valueOf(),
          ...options,
        },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      return resp.data;
    } catch (error) {
      console.error(error);

      throw new Error(`Request failed google`);
    }
  }

  async getActivityData(connectedUser: ConnectedUser, date: string): Promise<Activity> {
    const activity = await this.fetchGoogleData(connectedUser, date, {
      aggregateBy: [
        {
          dataTypeName: "com.google.calories.expended",
        },
        {
          dataTypeName: "com.google.step_count.delta",
        },
      ],
    });

    return mapToActivity(googleActivityResp.parse(activity), date);
  }

  async getBiometricsData(connectedUser: ConnectedUser, date: string): Promise<Biometrics> {
    const biometrics = await this.fetchGoogleData(connectedUser, date, {
      aggregateBy: [
        {
          dataTypeName: "	com.google.blood_pressure",
        },
        {
          dataTypeName: "com.google.blood_glucose",
        },
        {
          dataTypeName: "com.google.body.temperature",
        },
        {
          dataTypeName: "com.google.oxygen_saturation",
        },
        {
          dataTypeName: "com.google.heart_rate.bpm",
        },
      ],
    });
    return mapToBiometrics(googleBiometricsResp.parse(biometrics), date);
  }

  async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    const body = await this.fetchGoogleData(connectedUser, date, {
      aggregateBy: [
        {
          dataTypeName: "com.google.weight",
        },
        {
          dataTypeName: "com.google.height",
        },
        {
          dataTypeName: "com.google.body.fat.percentage",
        },
      ],
    });

    return mapToBody(googleBodyResp.parse(body), date);
  }

  async getNutritionData(connectedUser: ConnectedUser, date: string): Promise<Nutrition> {
    const nutrition = await this.fetchGoogleData(connectedUser, date, {
      aggregateBy: [
        {
          dataTypeName: "com.google.hydration",
        },
        {
          dataTypeName: "com.google.nutrition",
        },
      ],
    });

    return mapToNutrition(googleNutritionResp.parse(nutrition), date);
  }

  async getSleepData(connectedUser: ConnectedUser, date: string): Promise<Sleep> {
    const sleep = await this.fetchGoogleData(connectedUser, date, {
      aggregateBy: [
        {
          dataTypeName: "com.google.sleep.segment",
        },
      ],
    });

    return mapToSleep(googleSleepResp.parse(sleep), date);
  }
}
