import { Activity, Biometrics, Body, Sleep, User } from "@metriport/api";
import { Axios, AxiosResponse } from "axios";

import {
  mapToActivity,
  OuraDailyActivity,
  ouraDailyActivityResponse,
  OuraSessions,
  ouraSessionsResponse,
  OuraWorkouts,
  ouraWorkoutsResponse,
} from "../mappings/oura/activity";
import {
  mapToBiometrics,
  ouraHeartRateResponse,
} from "../mappings/oura/biometrics";
import { mapToBody } from "../mappings/oura/body";
import { mapToSleep, ouraSleepResponse } from "../mappings/oura/sleep";
import { mapToUser, ouraPersonalInfoResponse } from "../mappings/oura/user";
import { ConnectedUser, ProviderMap } from "../models/connected-user";
import { PROVIDER_OURA } from "../shared/constants";
import { getStartAndEndDate, getStartAndEndDateTime } from "../shared/date";
import { OAuth2, OAuth2DefaultImpl } from "./oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";
import { Config } from "../shared/config";

const axios: Axios = require("axios").default;

export class Oura extends Provider implements OAuth2 {
  static URL: string = "https://api.ouraring.com";
  static AUTHORIZATION_URL: string = "https://cloud.ouraring.com";
  static API_PATH: string = "v2/usercollection";
  private static clientId = Config.getOuraClientId();
  private static clientSecret = Config.getOuraClientSecret();

  constructor(
    private readonly oauth = new OAuth2DefaultImpl(
      PROVIDER_OURA,
      Oura.clientId,
      Oura.clientSecret,
      {
        tokenHost: Oura.AUTHORIZATION_URL,
      }
    )
  ) {
    super({
      [ConsumerHealthDataType.Activity]: true,
      [ConsumerHealthDataType.Body]: true,
      [ConsumerHealthDataType.Biometrics]: true,
      [ConsumerHealthDataType.Nutrition]: false,
      [ConsumerHealthDataType.Sleep]: true,
      [ConsumerHealthDataType.User]: true,
    });
  }

  async getAuthUri(state: string): Promise<string> {
    return this.oauth.getAuthUri(state);
  }

  async getTokenFromAuthCode(code: string): Promise<string> {
    return this.oauth.getTokenFromAuthCode(code);
  }

  async revokeProviderAccess(connectedUser: ConnectedUser) {
    return this.oauth.revokeWithNoOauth(connectedUser);
  }

  private async fetchOuraData<T>(
    connectedUser: ConnectedUser,
    endpoint: string,
    callBack: (response: AxiosResponse<any, any>) => Promise<T>,
    params?: { [k: string]: string }
  ): Promise<T> {
    try {
      const access_token = await this.oauth.getAccessToken(connectedUser);

      const resp = await axios.get(`${Oura.URL}/${Oura.API_PATH}/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        params,
      });
      return await callBack(resp);
    } catch (error) {
      console.error(error);

      throw new Error(`Oura Request failed ${endpoint}`);
    }
  }

  async getActivityData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Activity> {
    const [resFetchDaily, resBio, resSess, resWork] = await Promise.allSettled([
      this.fetchDailyActivity(connectedUser, date),
      this.getBiometricsData(connectedUser, date),
      this.fetchUserSessions(connectedUser, date),
      this.fetchWorkoutSessions(connectedUser, date),
    ]);

    const dailyActivty =
      resFetchDaily.status === "fulfilled" ? resFetchDaily.value : undefined;
    const biometrics = resBio.status === "fulfilled" ? resBio.value : undefined;
    const sessions = resSess.status === "fulfilled" ? resSess.value : undefined;
    const workouts = resWork.status === "fulfilled" ? resWork.value : undefined;

    if (!dailyActivty && !biometrics && !sessions && !workouts) {
      throw new Error("All Requests failed");
    }

    return mapToActivity(date, dailyActivty, biometrics, sessions, workouts);
  }

  async fetchDailyActivity(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<OuraDailyActivity> {
    const { start_date, end_date } = getStartAndEndDate(date);
    const params = {
      start_date: start_date,
      end_date: end_date,
    };

    return this.fetchOuraData<OuraDailyActivity>(
      connectedUser,
      "daily_activity",
      async (resp) => {
        return ouraDailyActivityResponse.parse(resp.data.data[0]);
      },
      params
    );
  }

  async fetchUserSessions(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<OuraSessions> {
    const { start_date, end_date } = getStartAndEndDate(date);
    const params = {
      start_date: start_date,
      end_date: end_date,
    };

    return this.fetchOuraData<OuraSessions>(
      connectedUser,
      "session",
      async (resp) => {
        return ouraSessionsResponse.parse(resp.data.data);
      },
      params
    );
  }

  async fetchWorkoutSessions(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<OuraWorkouts> {
    const { start_date, end_date } = getStartAndEndDate(date);
    const params = {
      start_date: start_date,
      end_date: end_date,
    };

    return this.fetchOuraData<OuraWorkouts>(
      connectedUser,
      "workout",
      async (resp) => {
        return ouraWorkoutsResponse.parse(resp.data.data);
      },
      params
    );
  }

  async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Biometrics> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    const params = {
      start_datetime: start_date,
      end_datetime: end_date,
    };

    return this.fetchOuraData<Biometrics>(
      connectedUser,
      "heartrate",
      async (resp) => {
        return mapToBiometrics(
          ouraHeartRateResponse.parse(resp.data.data),
          date
        );
      },
      params
    );
  }

  async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    return this.fetchOuraData<Body>(
      connectedUser,
      "personal_info",
      async (resp) => {
        return mapToBody(ouraPersonalInfoResponse.parse(resp.data), date);
      }
    );
  }

  async getSleepData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Sleep> {
    const { start_date, end_date } = getStartAndEndDate(date);
    const params = {
      start_date: start_date,
      end_date: end_date,
    };

    return this.fetchOuraData<Sleep>(
      connectedUser,
      "sleep",
      async (resp) => {
        // TODO: need to support multiple sleep sessions in our model,
        // technically someone could sleep twice in the same day. This is
        // especially true when we support date ranges
        return mapToSleep(ouraSleepResponse.parse(resp.data.data[0]), date);
      },
      params
    );
  }

  async getUserData(connectedUser: ConnectedUser, date: string): Promise<User> {
    return this.fetchOuraData<User>(
      connectedUser,
      "personal_info",
      async (resp) => {
        return mapToUser(ouraPersonalInfoResponse.parse(resp.data), date);
      }
    );
  }
}
