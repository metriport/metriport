import {
  Activity,
  Biometrics,
  Body,
  Nutrition,
  Sleep,
  User,
} from "@metriport/api";
import { Axios, AxiosResponse } from "axios";
import dayjs from "dayjs";

import { PROVIDER_GOOGLE } from "../shared/constants";
import { OAuth2, OAuth2DefaultImpl } from "./oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";
import { Config } from "../shared/config";
import { ConnectedUser } from "../models/connected-user";
import { mapToBody } from "../mappings/google/body";

const axios: Axios = require("axios").default;

export class Google extends Provider implements OAuth2 {
  static URL: string = "https://www.googleapis.com";
  static AUTHORIZATION_URL: string = "https://accounts.google.com";
  static TOKEN_HOST: string = "https://oauth2.googleapis.com";
  static AUTHORIZATION_PATH: string = "/o/oauth2/v2/auth";
  static TOKEN_PATH: string = "/token";
  static API_PATH: string = "/fitness/v1";
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
    "https://www.googleapis.com/auth/fitness.sleep.read"
  ];

  // TODO: MAKE SURE TO ADD TO INFRA
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
      [ConsumerHealthDataType.User]: true,
    });
  }

  async getAuthUri(state: string): Promise<string> {
    return this.oauth.getAuthUri(state);
  }

  async getTokenFromAuthCode(code: string): Promise<string> {
    return this.oauth.getTokenFromAuthCode(code);
  }

  // TODO: REVOKE ACCESS IS DONE THROUGH USERS GOOGLE ACCOUNT
  // IF ACCESS IS INVALID WHEN MAKING REQUEST REMOVE FROM PROVIDER MAP
  async revokeProviderAccess(connectedUser: ConnectedUser) {
    return this.oauth.revokeProviderAccess(connectedUser);
  }

  async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    try {
      const access_token = await this.oauth.getAccessToken(connectedUser);

      console.log(dayjs(date).valueOf())

      const resp = await axios.post(`${Google.URL}${Google.API_PATH}/users/me/dataset:aggregate`, {
        "aggregateBy": [{
          "dataTypeName": "com.google.weight",
          "dataSourceId": "derived:com.google.weight:com.google.android.gms:merge_weight"
        }],
        "startTimeMillis": dayjs(date).valueOf(),
        "endTimeMillis": dayjs(date).add(24, 'hours').valueOf()
      }, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      return mapToBody(resp.data, date);
    } catch (error) {
      console.error(error);

      throw new Error(`Request failed google`);
    }
  }
}
