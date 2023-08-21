import { PROVIDER_WHOOP } from "../shared/constants";
import { OAuth2, OAuth2DefaultImpl } from "./shared/oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";
import { Config } from "../shared/config";
import { ConnectedUser } from "../models/connected-user";
import { mapToBody } from "../mappings/whoop/body";
import { whoopBodyResp } from "../mappings/whoop/models/body";
import { Activity, Biometrics, Body, Sleep, User } from "@metriport/api-sdk";
import { whoopUserResp } from "../mappings/whoop/models/user";
import { mapToUser } from "../mappings/whoop/user";
import { whoopSleepResp } from "../mappings/whoop/models/sleep";
import { WhoopWorkout, whoopWorkoutResp } from "../mappings/whoop/models/workout";
import { mapToSleep } from "../mappings/whoop/sleep";
import { getStartAndEndDateTime } from "../shared/date";
import { mapToActivity } from "../mappings/whoop/activity";
import { WhoopCycle, whoopCycleResp } from "../mappings/whoop/models/cycle";
import { WhoopRecovery, whoopRecoveryResp } from "../mappings/whoop/models/recovery";
import { mapToBiometrics } from "../mappings/whoop/biometrics";

export class Whoop extends Provider implements OAuth2 {
  static BASE_URL = "https://api.prod.whoop.com";
  static AUTHORIZATION_PATH = "/oauth/oauth2/auth";
  static TOKEN_PATH = "/oauth/oauth2/token";
  static API_PATH = "/developer/v1";
  static DATA_URL = `${this.BASE_URL}${this.API_PATH}`;
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

  override async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Body>(
      `${Whoop.DATA_URL}/user/measurement/body`,
      accessToken,
      async resp => {
        return mapToBody(whoopBodyResp.parse(resp.data), date);
      }
    );
  }

  override async getUserData(connectedUser: ConnectedUser, date: string): Promise<User> {
    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<User>(
      `${Whoop.DATA_URL}/user/profile/basic`,
      accessToken,
      async resp => {
        return mapToUser(whoopUserResp.parse(resp.data), date);
      }
    );
  }

  override async getSleepData(connectedUser: ConnectedUser, date: string): Promise<Sleep> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Sleep>(
      `${Whoop.DATA_URL}/activity/sleep`,
      accessToken,
      async resp => {
        // TODO: need to support multiple sleep sessions in our model,
        // technically someone could sleep twice in the same day. This is
        // especially true when we support date rangess
        return mapToSleep(whoopSleepResp.parse(resp.data.records[0]), date);
      },
      { start: start_date, end: end_date }
    );
  }

  override async getActivityData(connectedUser: ConnectedUser, date: string): Promise<Activity> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Activity>(
      `${Whoop.DATA_URL}/activity/workout`,
      accessToken,
      async resp => {
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

  async fetchCycleData(accessToken: string, date: string): Promise<WhoopCycle> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    return this.oauth.fetchProviderData<WhoopCycle>(
      `${Whoop.DATA_URL}/cycle`,
      accessToken,
      async resp => {
        return whoopCycleResp.parse(resp.data.records[0]);
      },
      { start: start_date, end: end_date }
    );
  }

  async fetchRecoveryData(accessToken: string, date: string): Promise<WhoopRecovery> {
    const { start_date, end_date } = getStartAndEndDateTime(date);
    return this.oauth.fetchProviderData<WhoopRecovery>(
      `${Whoop.DATA_URL}/recovery`,
      accessToken,
      async resp => {
        return whoopRecoveryResp.parse(resp.data.records[0]);
      },
      { start: start_date, end: end_date }
    );
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Biometrics> {
    const accessToken = await this.getAccessToken(connectedUser);

    const [resCycle, resRecovery] = await Promise.allSettled([
      this.fetchCycleData(accessToken, date),
      this.fetchRecoveryData(accessToken, date),
    ]);
    const cycle = resCycle.status === "fulfilled" ? resCycle.value : undefined;
    const recovery = resRecovery.status === "fulfilled" ? resRecovery.value : undefined;
    if (!cycle && !recovery) {
      throw new Error("All Requests failed");
    }
    return mapToBiometrics(date, recovery, cycle);
  }
}
