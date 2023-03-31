import { Biometrics } from "@metriport/api";
import dayjs from "dayjs";
import Axios from "axios";
import { PROVIDER_DEXCOM } from "../shared/constants";
import { OAuth2, OAuth2DefaultImpl } from "./oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";
import { Config } from "../shared/config";
import { ConnectedUser } from "../models/connected-user";
import { getProviderDataFromConnectUserOrFail } from "../command/connected-user/get-connected-user";
import { mapToBiometrics } from "../mappings/dexcom/biometrics";
import { dexcomBiometricsResp } from "../mappings/dexcom/models/biometrics";

const axios = Axios.create();

export class Dexcom extends Provider implements OAuth2 {
  static URL = "https://sandbox-api.dexcom.com";
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

  private getAccessToken(connectedUser: ConnectedUser): string {
    const providerData = getProviderDataFromConnectUserOrFail(connectedUser, PROVIDER_DEXCOM);

    return providerData.token.access_token;
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

    const resp = await axios.post(`${Dexcom.URL}${Dexcom.TOKEN_PATH}`, formBody, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return resp.data;
  }

  async revokeProviderAccess(connectedUser: ConnectedUser) {
    await this.oauth.revokeLocal(connectedUser);
  }

  async getBiometricsData(connectedUser: ConnectedUser, date: string): Promise<Biometrics> {
    const accessToken = await this.getAccessToken(connectedUser);

    const query = new URLSearchParams({
      startDate: dayjs(date).format("YYYY-MM-DD"),
      endDate: dayjs(date).add(1, "day").format("YYYY-MM-DD"),
    }).toString();

    return this.oauth.fetchProviderData<Biometrics>(
      `${Dexcom.URL}/v3/users/self/egvs?${query}`,
      accessToken,
      async resp => {
        // return resp.data;
        return mapToBiometrics(dexcomBiometricsResp.parse(resp.data), date);
      }
    );
  }
}
