import { Activity, Biometrics, Body, Nutrition, ProviderSource, Sleep } from "@metriport/api-sdk";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import { mapToActivity } from "../mappings/google/activity";
import { mapToBiometrics } from "../mappings/google/biometrics";
import { mapToBody } from "../mappings/google/body";
import { GoogleSessions, sessionResp } from "../mappings/google/models";
import { GoogleActivity, googleActivityResp } from "../mappings/google/models/activity";
import { googleBiometricsResp } from "../mappings/google/models/biometrics";
import { googleBodyResp } from "../mappings/google/models/body";
import { googleNutritionResp } from "../mappings/google/models/nutrition";
import { sessionSleepType } from "../mappings/google/models/sleep";
import { mapToNutrition } from "../mappings/google/nutrition";
import { mapToSleep } from "../mappings/google/sleep";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import { PROVIDER_GOOGLE } from "../shared/constants";
import Provider, { ConsumerHealthDataType, DAPIParams } from "./provider";
import { ExtraType, executeAndReportAnalytics } from "./shared/analytics";
import { getHttpClient } from "./shared/http";
import { OAuth2, OAuth2DefaultImpl } from "./shared/oauth2";

dayjs.extend(timezone);

const api = getHttpClient();

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

  async getAccessToken(connectedUser: ConnectedUser): Promise<string> {
    const accessToken = await this.oauth.getAccessToken(connectedUser);
    return accessToken;
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
      throw new Error("Google Revoke failed", { cause: error });
    }
  }

  private async fetchGoogleData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any
  ) {
    const access_token = await this.getAccessToken(connectedUser);
    const baseDate = extraParams.timezoneId ? dayjs.tz(date, extraParams.timezoneId) : dayjs(date);
    const resp = await api.post(
      `${Google.URL}${Google.API_PATH}/users/me/dataset:aggregate`,
      {
        startTimeMillis: baseDate.valueOf(),
        endTimeMillis: baseDate.add(24, "hours").valueOf(),
        ...options,
      },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    return resp.data;
  }

  private async fetchGoogleSessions(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams,
    type?: number
  ) {
    const access_token = await this.getAccessToken(connectedUser);
    const baseDate = extraParams.timezoneId ? dayjs.tz(date, extraParams.timezoneId) : dayjs(date);
    const resp = await api.get(`${Google.URL}${Google.API_PATH}/users/me/sessions`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      params: {
        startTime: baseDate.toISOString(),
        endTime: baseDate.add(24, "hours").toISOString(),
        activityType: type,
      },
    });

    return resp.data;
  }

  override async getActivityData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Activity> {
    const getData = () =>
      Promise.allSettled([
        this.fetchActivitySessions(connectedUser, date, extraParams),
        this.fetchActivityData(connectedUser, date, extraParams),
      ]);
    const [resSessions, resData] = await execute(getData, connectedUser, {
      action: "getActivityData",
      date,
      timezone: extraParams.timezoneId,
    });

    const sessions = resSessions.status === "fulfilled" ? resSessions.value : undefined;

    const data = resData.status === "fulfilled" ? resData.value : undefined;

    if (!sessions && !data) {
      throw new Error("All Requests failed");
    }

    return mapToActivity(date, data, sessions);
  }

  async fetchActivitySessions(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<GoogleSessions> {
    const activitySessions = await this.fetchGoogleSessions(connectedUser, date, extraParams);

    return sessionResp.parse(activitySessions);
  }

  private async fetchActivityData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<GoogleActivity> {
    const activity = await this.fetchGoogleData(connectedUser, date, extraParams, {
      aggregateBy: [
        {
          dataTypeName: "com.google.active_minutes",
        },
        {
          dataTypeName: "com.google.activity.segment",
        },
        {
          dataTypeName: "com.google.calories.expended",
        },
        {
          dataTypeName: "com.google.step_count.delta",
        },
        {
          dataTypeName: "com.google.distance.delta",
        },
        {
          dataTypeName: "com.google.speed",
        },
      ],
    });

    return googleActivityResp.parse(activity);
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Biometrics> {
    const getData = () =>
      this.fetchGoogleData(connectedUser, date, extraParams, {
        aggregateBy: [
          {
            dataTypeName: "com.google.blood_pressure",
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
    const biometrics = await execute(getData, connectedUser, {
      action: "getBiometricsData",
      date,
      timezone: extraParams.timezoneId,
    });

    return mapToBiometrics(googleBiometricsResp.parse(biometrics), date);
  }

  override async getBodyData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Body> {
    const getData = () =>
      this.fetchGoogleData(connectedUser, date, extraParams, {
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
    const body = await execute(getData, connectedUser, {
      action: "getBodyData",
      date,
      timezone: extraParams.timezoneId,
    });

    return mapToBody(googleBodyResp.parse(body), date);
  }

  override async getNutritionData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Nutrition> {
    const getData = () =>
      this.fetchGoogleData(connectedUser, date, extraParams, {
        aggregateBy: [
          {
            dataTypeName: "com.google.hydration",
          },
          {
            dataTypeName: "com.google.nutrition",
          },
        ],
      });
    const nutrition = await execute(getData, connectedUser, {
      action: "getNutritionData",
      date,
      timezone: extraParams.timezoneId,
    });

    return mapToNutrition(googleNutritionResp.parse(nutrition), date);
  }

  override async getSleepData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Sleep> {
    const getData = () =>
      this.fetchGoogleSessions(connectedUser, date, extraParams, sessionSleepType);
    const sleepSessions = await execute(getData, connectedUser, {
      action: "getSleepData",
      date,
      timezone: extraParams.timezoneId,
    });

    return mapToSleep(sessionResp.parse(sleepSessions), date);
  }
}

/**
 * Sends a request to Google and report the duration to our analytics service.
 *
 * @param fnToExecute the function making the request to Google
 * @param connectedUser Metriport's connected user
 * @param additionalAnalyticsData additional information to send to the analytics service
 * @returns Google's response
 */
export async function execute<R>(
  fnToExecute: () => Promise<R>,
  connectedUser: ConnectedUser,
  additionalAnalyticsData: ExtraType
): Promise<R> {
  return executeAndReportAnalytics(
    fnToExecute,
    connectedUser,
    ProviderSource.google,
    additionalAnalyticsData
  );
}
