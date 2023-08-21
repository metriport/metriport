import { Activity, Biometrics, Body, Sleep, User } from "@metriport/api-sdk";
import {
  mapToActivity,
  OuraDailyActivity,
  ouraDailyActivityResponse,
  OuraSessions,
  ouraSessionsResponse,
  OuraWorkouts,
  ouraWorkoutsResponse,
} from "../mappings/oura/activity";
import { mapToBiometrics, ouraHeartRateResponse } from "../mappings/oura/biometrics";
import { mapToBody } from "../mappings/oura/body";
import { mapToSleep, ouraSleepResponse } from "../mappings/oura/sleep";
import { mapToUser, ouraPersonalInfoResponse } from "../mappings/oura/user";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import { PROVIDER_OURA } from "../shared/constants";
import { getStartAndEndDate, getStartAndEndDateTime } from "../shared/date";
import { OAuth2, OAuth2DefaultImpl } from "./shared/oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";

export class Oura extends Provider implements OAuth2 {
  static URL = "https://api.ouraring.com";
  static AUTHORIZATION_URL = "https://cloud.ouraring.com";
  static API_PATH = "v2/usercollection";
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

  async revokeProviderAccess(connectedUser: ConnectedUser): Promise<void> {
    await this.oauth.revokeLocal(connectedUser);
  }

  override async getActivityData(connectedUser: ConnectedUser, date: string): Promise<Activity> {
    const accessToken = await this.getAccessToken(connectedUser);

    const [resFetchDaily, resBio, resSess, resWork] = await Promise.allSettled([
      this.fetchDailyActivity(accessToken, date),
      this.getBiometricsData(connectedUser, date),
      this.fetchUserSessions(accessToken, date),
      this.fetchWorkoutSessions(accessToken, date),
    ]);

    const dailyActivty = resFetchDaily.status === "fulfilled" ? resFetchDaily.value : undefined;
    const biometrics = resBio.status === "fulfilled" ? resBio.value : undefined;
    const sessions = resSess.status === "fulfilled" ? resSess.value : undefined;
    const workouts = resWork.status === "fulfilled" ? resWork.value : undefined;

    if (!dailyActivty && !biometrics && !sessions && !workouts) {
      throw new Error("All Requests failed");
    }

    return mapToActivity(date, dailyActivty, biometrics, sessions, workouts);
  }

  async fetchDailyActivity(accessToken: string, date: string): Promise<OuraDailyActivity> {
    const { start_date, end_date } = getStartAndEndDate(date);
    const params = {
      start_date: start_date,
      end_date: end_date,
    };

    return this.oauth.fetchProviderData<OuraDailyActivity>(
      `${Oura.URL}/${Oura.API_PATH}/daily_activity`,
      accessToken,
      async resp => {
        return ouraDailyActivityResponse.parse(resp.data.data[0]);
      },
      params
    );
  }

  async fetchUserSessions(accessToken: string, date: string): Promise<OuraSessions> {
    const { start_date, end_date } = getStartAndEndDate(date);
    const params = {
      start_date: start_date,
      end_date: end_date,
    };

    return this.oauth.fetchProviderData<OuraSessions>(
      `${Oura.URL}/${Oura.API_PATH}/session`,
      accessToken,
      async resp => {
        return ouraSessionsResponse.parse(resp.data.data);
      },
      params
    );
  }

  async fetchWorkoutSessions(accessToken: string, date: string): Promise<OuraWorkouts> {
    const { start_date, end_date } = getStartAndEndDate(date);
    const params = {
      start_date: start_date,
      end_date: end_date,
    };

    return this.oauth.fetchProviderData<OuraWorkouts>(
      `${Oura.URL}/${Oura.API_PATH}/workout`,
      accessToken,
      async resp => {
        return ouraWorkoutsResponse.parse(resp.data.data);
      },
      params
    );
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Biometrics> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    const params = {
      start_datetime: start_date,
      end_datetime: end_date,
    };

    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Biometrics>(
      `${Oura.URL}/${Oura.API_PATH}/heartrate`,
      accessToken,
      async resp => {
        return mapToBiometrics(ouraHeartRateResponse.parse(resp.data.data), date);
      },
      params
    );
  }

  override async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Body>(
      `${Oura.URL}/${Oura.API_PATH}/personal_info`,
      accessToken,
      async resp => {
        return mapToBody(ouraPersonalInfoResponse.parse(resp.data), date);
      }
    );
  }

  override async getSleepData(connectedUser: ConnectedUser, date: string): Promise<Sleep> {
    const { start_date, end_date } = getStartAndEndDate(date);
    const params = {
      start_date: start_date,
      end_date: end_date,
    };
    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Sleep>(
      `${Oura.URL}/${Oura.API_PATH}/sleep`,
      accessToken,
      async resp => {
        // TODO: need to support multiple sleep sessions in our model,
        // technically someone could sleep twice in the same day. This is
        // especially true when we support date ranges
        return mapToSleep(ouraSleepResponse.parse(resp.data.data[0]), date);
      },
      params
    );
  }

  override async getUserData(connectedUser: ConnectedUser, date: string): Promise<User> {
    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<User>(
      `${Oura.URL}/${Oura.API_PATH}/personal_info`,
      accessToken,
      async resp => {
        return mapToUser(ouraPersonalInfoResponse.parse(resp.data), date);
      }
    );
  }
}
