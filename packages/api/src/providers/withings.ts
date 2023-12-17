import { Activity, Biometrics, Body, Sleep } from "@metriport/api-sdk";
import crypto from "crypto";
import dayjs from "dayjs";
import { Token } from "simple-oauth2";
import { getProviderTokenFromConnectedUserOrFail } from "../command/connected-user/get-connected-user";
import { updateProviderData } from "../command/connected-user/save-connected-user";
import {
  activityCategory,
  biometricsCategories,
  bodyCategory,
  sleepCategory,
} from "../command/webhook/withings";
import MetriportError from "../errors/metriport-error";
import { mapToActivity } from "../mappings/withings/activity";
import { mapToBiometrics } from "../mappings/withings/biometrics";
import { mapToBody } from "../mappings/withings/body";
import {
  withingsActivityLogResp,
  WithingsActivityLogs,
} from "../mappings/withings/models/activity";
import { WithingsHeartRate, withingsHeartRateResp } from "../mappings/withings/models/heart-rate";
import {
  withingsMeasurementResp,
  WithingsMeasurements,
} from "../mappings/withings/models/measurements";
import { withingsSleepResp } from "../mappings/withings/models/sleep";
import { userDevicesSchema, WithingsUserDevices } from "../mappings/withings/models/user";
import { WithingsWorkoutLogs, withingsWorkoutLogsResp } from "../mappings/withings/models/workouts";
import { mapToSleep } from "../mappings/withings/sleep";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import { PROVIDER_WITHINGS } from "../shared/constants";
import { capture } from "@metriport/core/util/notifications";
import { Util } from "../shared/util";
import Provider, { ConsumerHealthDataType } from "./provider";
import { getHttpClient } from "./shared/http";
import { OAuth2, OAuth2DefaultImpl } from "./shared/oauth2";

const api = getHttpClient();

export class Withings extends Provider implements OAuth2 {
  static URL = "https://wbsapi.withings.net";
  static AUTHORIZATION_URL = "https://account.withings.com";
  static AUTHORIZATION_PATH = "/oauth2_user/authorize2";
  static TOKEN_PATH = "/v2/oauth2";
  static API_PATH = "v2";
  static scopes = "user.activity,user.metrics,user.info";
  static STATUS_OK = 0;

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
      [ConsumerHealthDataType.Body]: true,
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
    const response = await api.post(
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

    response.data.body.expires_at = dayjs(Date.now())
      .add(response.data.body.expires_in, "seconds")
      .unix();

    return JSON.stringify(response.data.body);
  }

  async postAuth(token: string) {
    const callbackUrl = `${Config.getApiUrl()}/webhook/${PROVIDER_WITHINGS}`;
    const access_token = JSON.parse(token).access_token;
    const webhookCategories = [
      activityCategory,
      bodyCategory,
      biometricsCategories,
      sleepCategory,
    ].flat();
    const subscriptionUrl = "https://wbsapi.withings.net/notify";
    for (const category of webhookCategories) {
      const subscriptionBody = `action=subscribe&callbackurl=${callbackUrl}&appli=${category}`;
      try {
        const resp = await api.post(subscriptionUrl, subscriptionBody, {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        });
        console.log(resp.data);
      } catch (error) {
        capture.error(error, {
          extra: { context: `withings.postAuth`, subscriptionUrl, subscriptionBody },
        });

        throw new Error(`WH subscription failed Withings`, { cause: error });
      }
    }
  }

  async getAccessToken(connectedUser: ConnectedUser): Promise<string> {
    const token = getProviderTokenFromConnectedUserOrFail(connectedUser, PROVIDER_WITHINGS);

    const refreshedToken = await this.checkRefreshToken(token, connectedUser);

    return refreshedToken.access_token;
  }

  async checkRefreshToken(token: string, connectedUser: ConnectedUser): Promise<Token> {
    const access_token = JSON.parse(token);
    const isExpired = Util.isTokenExpired(access_token.expires_at);

    if (isExpired) {
      try {
        const response = await api.post(
          "https://wbsapi.withings.net/v2/oauth2",
          `action=requesttoken&grant_type=refresh_token&client_id=${Withings.clientId}&client_secret=${Withings.clientSecret}&refresh_token=${access_token.refresh_token}`,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        if (response.data?.status !== Withings.STATUS_OK) {
          console.log(response.data);
          throw new Error(response.data.error);
        }

        response.data.body.expires_at = dayjs()
          .add(response.data.body.expires_in, "seconds")
          .unix();

        const providerItem = connectedUser.providerMap
          ? {
              ...connectedUser.providerMap[PROVIDER_WITHINGS],
              token: JSON.stringify(response.data.body),
            }
          : { token: JSON.stringify(response.data.body) };

        await updateProviderData({
          id: connectedUser.id,
          cxId: connectedUser.cxId,
          provider: PROVIDER_WITHINGS,
          providerItem,
        });

        return response.data.body;
      } catch (error) {
        console.log("Error refreshing access token: ", error);
        throw new Error("Error refreshing access token", { cause: error });
      }
    }

    return access_token;
  }

  async revokeProviderAccess(connectedUser: ConnectedUser) {
    const token = getProviderTokenFromConnectedUserOrFail(connectedUser, PROVIDER_WITHINGS);

    const client_id = Config.getWithingsClientId();
    const client_secret = Config.getWithingsClientSecret();
    const timestamp = dayjs().unix();

    const nonce = await this.getNonce(client_id, client_secret, timestamp);
    const status = await this.revokeToken(client_id, client_secret, timestamp, nonce, token);

    if (status === 0) {
      await this.oauth.revokeLocal(connectedUser);
    } else {
      throw new Error("Withings Revoke failed");
    }
  }

  async getNonce(clientId: string, clientSecret: string, timestamp: number): Promise<string> {
    const nonceAction = "getnonce";
    const nonceSignature = `${nonceAction},${clientId},${timestamp}`;
    const hashString = crypto
      .createHmac("sha256", clientSecret)
      .update(nonceSignature)
      .digest("hex");

    const { data } = await api.post(
      `${Withings.URL}/v2/signature?action=${nonceAction}&client_id=${clientId}&timestamp=${timestamp}&signature=${hashString}`
    );

    return data.body.nonce;
  }

  async revokeToken(
    clientId: string,
    clientSecret: string,
    timestamp: number,
    nonce: string,
    token: string
  ): Promise<number> {
    const revokeAction = "revoke";
    const revokeSignature = `${revokeAction},${clientId},${nonce}`;
    const revokeHashString = crypto
      .createHmac("sha256", clientSecret)
      .update(revokeSignature)
      .digest("hex");
    const parsedToken = JSON.parse(token);

    const { data } = await api.post(`
    ${Withings.URL}/${Withings.TOKEN_PATH}?action=revoke&client_id=${clientId}&timestamp=${timestamp}&signature=${revokeHashString}&userid=${parsedToken.userid}&nonce=${nonce}
  `);

    return data.status;
  }

  async fetchActivityData(accessToken: string, date: string): Promise<WithingsActivityLogs> {
    const params = {
      action: "getactivity",
      startdateymd: date,
      enddateymd: date,
    };

    return this.oauth.fetchProviderData<WithingsActivityLogs>(
      `${Withings.URL}/${Withings.API_PATH}/measure`,
      accessToken,
      async resp => {
        return withingsActivityLogResp.parse(resp.data.body.activities);
      },
      params
    );
  }

  async fetchWorkoutData(accessToken: string, date: string): Promise<WithingsWorkoutLogs> {
    const params = {
      action: "getworkouts",
      startdateymd: date,
      enddateymd: date,
    };

    return this.oauth.fetchProviderData<WithingsWorkoutLogs>(
      `${Withings.URL}/${Withings.API_PATH}/measure`,
      accessToken,
      async resp => {
        return withingsWorkoutLogsResp.parse(resp.data.body.series);
      },
      params
    );
  }

  override async getActivityData(connectedUser: ConnectedUser, date: string): Promise<Activity> {
    const accessToken = await this.getAccessToken(connectedUser);

    const [resActivity, resWorkouts] = await Promise.allSettled([
      this.fetchActivityData(accessToken, date),
      this.fetchWorkoutData(accessToken, date),
    ]);

    const activity = resActivity.status === "fulfilled" ? resActivity.value : undefined;
    const workouts = resWorkouts.status === "fulfilled" ? resWorkouts.value : undefined;

    if (!activity && !workouts) {
      throw new Error("All Requests failed");
    }
    return mapToActivity(date, activity, workouts);
  }

  async fetchMeasurementData(accessToken: string, date: string): Promise<WithingsMeasurements> {
    const params = {
      action: "getmeas",
      startdate: dayjs(date).unix(),
      enddate: dayjs(date).add(1, "day").unix(),
    };

    const response = await api.post(`${Withings.URL}/measure`, null, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params,
    });

    if (response.data?.status !== Withings.STATUS_OK) {
      const msg = `Error fetching measure data from Withings`;
      console.log(`${msg} - response: ${JSON.stringify(response.data)}`);
      capture.error(msg, {
        extra: {
          context: `withings.fetch.measurements`,
          status: response.status,
          statusText: response.statusText,
          response: response.data,
        },
      });
      throw new MetriportError(msg, undefined, {
        status: response.status,
        statusText: response.statusText,
      });
    }

    return withingsMeasurementResp.parse(response.data.body);
  }

  async fetchDevices(accessToken: string): Promise<WithingsUserDevices> {
    const params = {
      action: "getdevice",
    };

    return this.oauth.fetchProviderData<WithingsUserDevices>(
      `${Withings.URL}/${Withings.API_PATH}/user`,
      accessToken,
      async resp => {
        return userDevicesSchema.parse(resp.data.body.devices);
      },
      params
    );
  }

  override async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    const accessToken = await this.getAccessToken(connectedUser);

    const response = await this.fetchMeasurementData(accessToken, date);

    const hasDevices = response.measuregrps.filter(measure => measure.deviceid);

    if (hasDevices.length) {
      const devices = await this.fetchDevices(accessToken);
      return mapToBody(date, response, devices);
    }

    return mapToBody(date, response);
  }

  async fetchHeartData(accessToken: string, date: string): Promise<WithingsHeartRate> {
    const params = {
      action: "list",
      startdate: dayjs(date).unix(),
    };

    return this.oauth.fetchProviderData<WithingsHeartRate>(
      `${Withings.URL}/${Withings.API_PATH}/heart`,
      accessToken,
      async resp => {
        return withingsHeartRateResp.parse(resp.data.body.series);
      },
      params
    );
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Biometrics> {
    const accessToken = await this.getAccessToken(connectedUser);

    const [resHeart, resBody] = await Promise.allSettled([
      this.fetchHeartData(accessToken, date),
      this.fetchMeasurementData(accessToken, date),
    ]);

    const heart = resHeart.status === "fulfilled" ? resHeart.value : undefined;
    const body = resBody.status === "fulfilled" ? resBody.value : undefined;

    if (!heart && !body) {
      throw new Error("All Requests failed");
    }

    return mapToBiometrics(date, heart, body);
  }

  override async getSleepData(connectedUser: ConnectedUser, date: string): Promise<Sleep> {
    const params = {
      action: "getsummary",
      startdateymd: date,
      enddateymd: date,
    };

    const accessToken = await this.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Sleep>(
      `${Withings.URL}/${Withings.API_PATH}/sleep`,
      accessToken,
      async resp => {
        return mapToSleep(date, withingsSleepResp.parse(resp.data.body.series));
      },
      params
    );
  }
}
