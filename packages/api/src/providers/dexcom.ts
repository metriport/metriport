import { Biometrics, Nutrition } from "@metriport/api-sdk";
import dayjs from "dayjs";
import { Token } from "simple-oauth2";
import { getProviderTokenFromConnectedUserOrFail } from "../command/connected-user/get-connected-user";
import { updateProviderData } from "../command/connected-user/save-connected-user";
import { mapToBiometrics } from "../mappings/dexcom/biometrics";
import { dexcomEventsResp } from "../mappings/dexcom/models/events";
import { dexcomEvgsResp } from "../mappings/dexcom/models/evgs";
import { mapToNutrition } from "../mappings/dexcom/nutrition";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import { PROVIDER_DEXCOM } from "../shared/constants";
import { ISO_DATE } from "../shared/date";
import { Util } from "../shared/util";
import Provider, { ConsumerHealthDataType } from "./provider";
import { getHttpClient } from "./shared/http";
import { OAuth2, OAuth2DefaultImpl } from "./shared/oauth2";

const api = getHttpClient();

export class Dexcom extends Provider implements OAuth2 {
  static URL =
    Config.isProdEnv() || Config.isSandbox()
      ? "https://api.dexcom.com/"
      : "https://sandbox-api.dexcom.com";
  static AUTHORIZATION_PATH = "/v2/oauth2/login";
  static TOKEN_PATH = "/v2/oauth2/token";
  static scopes = "offline_access";

  private static clientId = Config.getDexcomClientId();
  private static clientSecret = Config.getDexcomClientSecret();

  constructor(
    private readonly oauth = new OAuth2DefaultImpl(
      PROVIDER_DEXCOM,
      Dexcom.clientId,
      Dexcom.clientSecret,
      {
        authorizeHost: Dexcom.URL,
        tokenHost: Dexcom.URL,
        authorizePath: Dexcom.AUTHORIZATION_PATH,
        tokenPath: Dexcom.TOKEN_PATH,
      },
      Dexcom.scopes
    )
  ) {
    super({
      [ConsumerHealthDataType.Activity]: false,
      [ConsumerHealthDataType.Body]: false,
      [ConsumerHealthDataType.Biometrics]: true,
      [ConsumerHealthDataType.Nutrition]: true,
      [ConsumerHealthDataType.Sleep]: false,
      [ConsumerHealthDataType.User]: false,
    });
  }

  async getAccessToken(connectedUser: ConnectedUser): Promise<string> {
    const token = getProviderTokenFromConnectedUserOrFail(connectedUser, PROVIDER_DEXCOM);

    const refreshedToken = await this.checkRefreshToken(token, connectedUser);

    return refreshedToken.access_token;
  }

  async checkRefreshToken(token: string, connectedUser: ConnectedUser): Promise<Token> {
    const access_token = JSON.parse(token);
    const isExpired = Util.isTokenExpired(access_token.expires_at);

    if (isExpired) {
      const formData = {
        grant_type: "refresh_token",
        refresh_token: access_token.refresh_token,
        redirect_uri: this.oauth.getRedirectUri(),
        client_id: Dexcom.clientId,
        client_secret: Dexcom.clientSecret,
      };

      const formBody = new URLSearchParams(formData).toString();

      try {
        const response = await api.post(`${Dexcom.URL}${Dexcom.TOKEN_PATH}`, formBody, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        response.data.expires_at = dayjs().add(response.data.expires_in, "seconds").unix();

        const providerItem = connectedUser.providerMap
          ? {
              ...connectedUser.providerMap[PROVIDER_DEXCOM],
              token: JSON.stringify(response.data),
            }
          : { token: JSON.stringify(response.data) };

        await updateProviderData({
          id: connectedUser.id,
          cxId: connectedUser.cxId,
          provider: PROVIDER_DEXCOM,
          providerItem,
        });

        return response.data;
      } catch (error) {
        throw new Error("Error refreshing access token", { cause: error });
      }
    }

    return access_token;
  }

  async getAuthUri(state: string): Promise<string> {
    return this.oauth.getAuthUri(state);
  }

  async getTokenFromAuthCode(code: string): Promise<string> {
    const formData = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: this.oauth.getRedirectUri(),
      client_id: Dexcom.clientId,
      client_secret: Dexcom.clientSecret,
    };

    const formBody = new URLSearchParams(formData).toString();

    const resp = await api.post(`${Dexcom.URL}${Dexcom.TOKEN_PATH}`, formBody, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    resp.data.expires_at = dayjs().add(resp.data.expires_in, "seconds").unix();

    return JSON.stringify(resp.data);
  }

  async revokeProviderAccess(connectedUser: ConnectedUser) {
    await this.oauth.revokeLocal(connectedUser);
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Biometrics> {
    const accessToken = await this.getAccessToken(connectedUser);

    const query = new URLSearchParams({
      startDate: dayjs(date).format(ISO_DATE),
      endDate: dayjs(date).add(1, "day").format(ISO_DATE),
    }).toString();

    return this.oauth.fetchProviderData<Biometrics>(
      `${Dexcom.URL}/v3/users/self/egvs?${query}`,
      accessToken,
      async resp => {
        return mapToBiometrics(dexcomEvgsResp.parse(resp.data), date);
      }
    );
  }

  override async getNutritionData(connectedUser: ConnectedUser, date: string): Promise<Nutrition> {
    const accessToken = await this.getAccessToken(connectedUser);

    const query = new URLSearchParams({
      startDate: dayjs(date).format(ISO_DATE),
      endDate: dayjs(date).add(1, "day").format(ISO_DATE),
    }).toString();

    return this.oauth.fetchProviderData<Nutrition>(
      `${Dexcom.URL}/v3/users/self/events?${query}`,
      accessToken,
      async resp => {
        return mapToNutrition(dexcomEventsResp.parse(resp.data), date);
      }
    );
  }
}
