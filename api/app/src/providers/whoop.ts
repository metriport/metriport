import { Axios } from "axios";

import { PROVIDER_WHOOP } from "../shared/constants";
import { OAuth2, OAuth2DefaultImpl } from "./oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";
import { Config } from "../shared/config";
import { ConnectedUser } from "../models/connected-user";
import { mapToBody } from "../mappings/whoop/body";
import { whoopBodyResp } from "../mappings/whoop/models/body";
import { Activity, Biometrics, Body, Sleep, User } from "@metriport/api";
import { whoopUserResp } from "../mappings/whoop/models/user";
import { mapToUser } from "../mappings/whoop/user";
import { whoopSleepResp } from "../mappings/whoop/models/sleep";
import {
  WhoopWorkout,
  whoopWorkoutResp,
} from "../mappings/whoop/models/workout";
import { mapToSleep } from "../mappings/whoop/sleep";
import { getStartAndEndDateTime } from "../shared/date";
import { mapToActivity } from "../mappings/whoop/activity";
import { WhoopCycle, whoopCycleResp } from "../mappings/whoop/models/cycle";
import {
  WhoopRecovery,
  whoopRecoveryResp,
} from "../mappings/whoop/models/recovery";
import { mapToBiometrics } from "../mappings/whoop/biometrics";

export class Whoop extends Provider implements OAuth2 {
  static BASE_URL: string = "https://api.prod.whoop.com";
  static AUTHORIZATION_PATH: string = "/oauth/oauth2/auth";
  static TOKEN_PATH: string = "/oauth/oauth2/token";
  static API_PATH: string = "/developer/v1";
  static DATA_URL: string = `${this.BASE_URL}${this.API_PATH}`;
  static scopes = [
    "read:recovery",
    "read:cycles",
    "read:workout",
    "read:sleep",
    "read:profile",
    "read:body_measurement",
    "offline",
  ];

  private static clientId = Config.getWhoopClientId();
  private static clientSecret = Config.getWhoopClientSecret();

  constructor(
    private readonly oauth = new OAuth2DefaultImpl(
      PROVIDER_WHOOP,
      Whoop.clientId,
      Whoop.clientSecret,
      {
        authorizeHost: Whoop.BASE_URL,
        tokenHost: Whoop.BASE_URL,
        authorizePath: Whoop.AUTHORIZATION_PATH,
        tokenPath: Whoop.TOKEN_PATH,
      },
      Whoop.scopes,
      { authorizationMethod: "body" }
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

  async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    return this.oauth.fetchProviderData<Body>(
      connectedUser,
      `${Whoop.DATA_URL}/user/measurement/body`,
      async (resp) => {
        return mapToBody(whoopBodyResp.parse(resp.data), date);
      }
    );
  }

  async getUserData(connectedUser: ConnectedUser, date: string): Promise<User> {
    return this.oauth.fetchProviderData<User>(
      connectedUser,
      `${Whoop.DATA_URL}/user/profile/basic`,
      async (resp) => {
        return mapToUser(whoopUserResp.parse(resp.data), date);
      }
    );
  }

  async getSleepData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Sleep> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    return this.oauth.fetchProviderData<Sleep>(
      connectedUser,
      `${Whoop.DATA_URL}/activity/sleep`,
      async (resp) => {
        // TODO: need to support multiple sleep sessions in our model,
        // technically someone could sleep twice in the same day. This is
        // especially true when we support date rangess
        return mapToSleep(whoopSleepResp.parse(resp.data.records[0]), date);
      },
      { start: start_date, end: end_date }
    );
  }

  async getActivityData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Activity> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    return this.oauth.fetchProviderData<Activity>(
      connectedUser,
      `${Whoop.DATA_URL}/activity/workout`,
      async (resp) => {
        const whoopWorkouts: WhoopWorkout[] = [];
        if (resp.data && resp.data.records) {
          for (const workoutJson of resp.data.records) {
            whoopWorkouts.push(whoopWorkoutResp.parse(workoutJson));
          }
        }
        return mapToActivity(whoopWorkouts, date);
      },
      { start: start_date, end: end_date }
    );
  }

  async fetchCycleData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<WhoopCycle> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    return this.oauth.fetchProviderData<WhoopCycle>(
      connectedUser,
      `${Whoop.DATA_URL}/cycle`,
      async (resp) => {
        return whoopCycleResp.parse(resp.data.records[0]);
      },
      { start: start_date, end: end_date }
    );
  }

  async fetchRecoveryData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<WhoopRecovery> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    return this.oauth.fetchProviderData<WhoopRecovery>(
      connectedUser,
      `${Whoop.DATA_URL}/recovery`,
      async (resp) => {
        return whoopRecoveryResp.parse(resp.data.records[0]);
      },
      { start: start_date, end: end_date }
    );
  }

  async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Biometrics> {
    const [resCycle, resRecovery] = await Promise.allSettled([
      this.fetchCycleData(connectedUser, date),
      this.fetchRecoveryData(connectedUser, date),
    ]);
    const cycle = resCycle.status === "fulfilled" ? resCycle.value : undefined;
    const recovery =
      resRecovery.status === "fulfilled" ? resRecovery.value : undefined;
    if (!cycle && !recovery) {
      throw new Error("All Requests failed");
    }
    return mapToBiometrics(date, recovery, cycle);
  }
}
