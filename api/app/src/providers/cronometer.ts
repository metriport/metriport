import { Nutrition } from "@metriport/api";
import Axios from "axios";
import UnauthorizedError from "../errors/unauthorized";
import { cronometerDiarySummaryResp } from "../mappings/cronometer/models/diary-summary";
import { mapToNutrition } from "../mappings/cronometer/nutrition";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import { PROVIDER_CRONOMETER } from "../shared/constants";
import { OAuth2, OAuth2DefaultImpl } from "./oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";

const axios = Axios.create();

export class Cronometer extends Provider implements OAuth2 {
  static URL: string = "https://cronometer.com";
  static API_PATH: string = "api_v1";
  constructor(
    private readonly oauth = new OAuth2DefaultImpl(
      PROVIDER_CRONOMETER,
      Config.getCronometerClientId(),
      Config.getCronometerClientSecret(),
      { tokenHost: Cronometer.URL }
    )
  ) {
    super({
      [ConsumerHealthDataType.Activity]: false,
      [ConsumerHealthDataType.Body]: false,
      [ConsumerHealthDataType.Biometrics]: false,
      [ConsumerHealthDataType.Nutrition]: true,
      [ConsumerHealthDataType.Sleep]: false,
      [ConsumerHealthDataType.User]: false,
    });
  }

  async getAuthUri(state: string): Promise<string> {
    return this.oauth.getAuthUri(state);
  }

  // cronometer does not have refresh tokens or any expiry, so need custom
  // behavior here
  async getTokenFromAuthCode(code: string): Promise<string> {
    const resp = await axios.post(
      `${Cronometer.URL}/oauth/token` +
        `?grant_type=authorization_code` +
        `&code=${code}` +
        `&client_id=${Config.getCronometerClientId()}` +
        `&client_secret=${Config.getCronometerClientSecret()}`
    );
    return resp.data.access_token;
  }

  private getAccessToken(connectedUser: ConnectedUser): string {
    if (!connectedUser.providerMap) throw new UnauthorizedError();
    const providerData = connectedUser.providerMap[PROVIDER_CRONOMETER];
    if (!providerData) throw new UnauthorizedError();

    return providerData.token;
  }

  async getNutritionData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Nutrition> {
    // not using fetchProviderData here on purpose due to interesting API design - this is a POST
    const resp = await axios.post(
      `${Cronometer.URL}/${Cronometer.API_PATH}/diary_summary`,
      {
        day: date,
        // food: true, TODO
      },
      {
        headers: {
          Authorization: `Bearer ${this.getAccessToken(connectedUser)}`,
        },
      }
    );
    return mapToNutrition(cronometerDiarySummaryResp.parse(resp.data), date);
  }
}
