import {
  Activity,
  Biometrics,
  Body,
  Nutrition,
  Sleep,
  User,
} from "@metriport/api";
import { Axios } from "axios";
import dayjs from "dayjs";

import { PROVIDER_WITHINGS } from "../shared/constants";
import { ConnectedUser, ProviderMap } from "../models/connected-user";
import { OAuth2, OAuth2DefaultImpl } from "./oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";
import { Config } from "../shared/config";

import { mapToActivity } from "../mappings/withings/activity";
import { mapToBiometrics } from "../mappings/withings/biometrics";
import { mapToSleep } from "../mappings/withings/sleep";

import {
  withingsActivityLogResp,
  WithingsActivityLogs,
} from "../mappings/withings/models/activity";
import {
  withingsWorkoutLogsResp,
  WithingsWorkoutLogs,
} from "../mappings/withings/models/workouts";
import { withingsHeartRateResp } from "../mappings/withings/models/heart-rate";
import { withingsSleepResp } from "../mappings/withings/models/sleep";

const axios: Axios = require("axios").default;

export class Withings extends Provider implements OAuth2 {
  static URL: string = "https://wbsapi.withings.net";
  static AUTHORIZATION_URL: string = "https://account.withings.com";
  static AUTHORIZATION_PATH: string = "/oauth2_user/authorize2";
  static TOKEN_PATH: string = "/v2/oauth2";
  static API_PATH: string = "v2";
  static scopes = "user.activity,user.metrics";

  private static clientId = Config.getWithingsClientId();
  private static clientSecret = Config.getWithingsClientSecret();

  constructor(
    private readonly oauth = new OAuth2DefaultImpl(
      PROVIDER_WITHINGS,
      Withings.clientId,
      Withings.clientSecret,
      {
        authorizeHost: Withings.AUTHORIZATION_URL,
        tokenHost: Withings.URL,
        authorizePath: Withings.AUTHORIZATION_PATH,
        tokenPath: Withings.TOKEN_PATH,
      },
      Withings.scopes
    )
  ) {
    super({
      [ConsumerHealthDataType.Activity]: true,
      [ConsumerHealthDataType.Body]: false,
      [ConsumerHealthDataType.Biometrics]: true,
      [ConsumerHealthDataType.Nutrition]: false,
      [ConsumerHealthDataType.Sleep]: true,
      [ConsumerHealthDataType.User]: false,
    });
  }

  async getAuthUri(state: string): Promise<string> {
    return this.oauth.getAuthUri(state);
  }


  async getTokenFromAuthCode(code: string): Promise<string> {
    // TODO: WILL UDPDATE IT JUST WASNT STRAIGHT FORWARD - NEEDED CLIENTID TO BE IN PARAMS WITH ACTION = REQUEST
    const response = await axios.post(
      "https://wbsapi.withings.net/v2/oauth2",
      `action=requesttoken&grant_type=authorization_code&client_id=${
        Withings.clientId
      }&client_secret=${
        Withings.clientSecret
      }&code=${code}&redirect_uri=${this.oauth.getRedirectUri()}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return JSON.stringify(response.data.body);
  }

  async revokeProviderAccess(connectedUser: ConnectedUser) {
    return this.oauth.revokeWithNoOauth(connectedUser);
  }

  async fetchActivityData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<WithingsActivityLogs> {
    const params = {
      action: "getactivity",
      startdateymd: date,
      enddateymd: date,
    };

    return this.oauth.fetchProviderData<WithingsActivityLogs>(
      connectedUser,
      `${Withings.URL}/${Withings.API_PATH}/measure`,
      async (resp) => {
        return withingsActivityLogResp.parse(resp.data.body.activities);
      },
      params
    );
  }

  async fetchWorkoutData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<WithingsWorkoutLogs> {
    const params = {
      action: "getworkouts",
      startdateymd: date,
      enddateymd: date,
    };

    return this.oauth.fetchProviderData<WithingsWorkoutLogs>(
      connectedUser,
      `${Withings.URL}/${Withings.API_PATH}/measure`,
      async (resp) => {
        return withingsWorkoutLogsResp.parse(resp.data.body.series);
      },
      params
    );
  }

  async getActivityData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Activity> {
    const [resActivity, resWorkouts] = await Promise.allSettled([
      this.fetchActivityData(connectedUser, date),
      this.fetchWorkoutData(connectedUser, date),
    ]);

    const activity =
      resActivity.status === "fulfilled" ? resActivity.value : undefined;
    const workouts =
      resWorkouts.status === "fulfilled" ? resWorkouts.value : undefined;

    if (!activity && !workouts) {
      throw new Error("All Requests failed");
    }
    return mapToActivity(date, activity, workouts);
  }

  async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Biometrics> {
    const params = {
      action: "list",
      startdate: dayjs(date).unix(),
    };

    return this.oauth.fetchProviderData<Biometrics>(
      connectedUser,
      `${Withings.URL}/${Withings.API_PATH}/heart`,
      async (resp) => {
        return mapToBiometrics(
          date,
          withingsHeartRateResp.parse(resp.data.body.series)
        );
      },
      params
    );
  }

  async getSleepData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Sleep> {
    const params = {
      action: "getsummary",
      startdateymd: date,
      enddateymd: date,
    };

    return this.oauth.fetchProviderData<Sleep>(
      connectedUser,
      `${Withings.URL}/${Withings.API_PATH}/sleep`,
      async (resp) => {
        return mapToSleep(date, withingsSleepResp.parse(resp.data.body.series));
      },
      params
    );
  }
}
