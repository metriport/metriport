import { Activity, Biometrics, Body, Nutrition, Sleep, User } from "@metriport/api-sdk";

import axios from "axios";
import { mapToActivity } from "../mappings/fitbit/activity";
import { mapToBiometrics } from "../mappings/fitbit/biometrics";
import { mapToBody } from "../mappings/fitbit/body";
import {
  FitbitCollectionTypesWithoutUserRevokedAccess,
  FitbitScopes,
} from "../mappings/fitbit/constants";
import { fitbitActivityLogResp } from "../mappings/fitbit/models/activity-log";
import {
  FitbitBreathingRate,
  fitbitBreathingRateResp,
} from "../mappings/fitbit/models/breathing-rate";
import { FitbitCardioScore, fitbitCardioScoreResp } from "../mappings/fitbit/models/cardio-score";
import { FitbitFood, fitbitFoodResp } from "../mappings/fitbit/models/food";
import { FitbitHeartRate, fitbitHeartRateResp } from "../mappings/fitbit/models/heart-rate";
import {
  FitbitHeartVariability,
  fitbitHeartVariabilityResp,
} from "../mappings/fitbit/models/heart-variability";
import { fitbitSleepResp } from "../mappings/fitbit/models/sleep";
import { FitbitSpo2, fitbitSpo2Resp } from "../mappings/fitbit/models/spo2";
import { FitbitTempCore, fitbitTempCoreResp } from "../mappings/fitbit/models/temperature-core";
import { FitbitTempSkin, fitbitTempSkinResp } from "../mappings/fitbit/models/temperature-skin";
import { FitbitUser, fitbitUserResp } from "../mappings/fitbit/models/user";
import { FitbitWater, fitbitWaterResp } from "../mappings/fitbit/models/water";
import { FitbitWeight, weightSchema } from "../mappings/fitbit/models/weight";
import { mapToNutrition } from "../mappings/fitbit/nutrition";
import { mapToSleep } from "../mappings/fitbit/sleep";
import { mapToUser } from "../mappings/fitbit/user";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import { PROVIDER_FITBIT } from "../shared/constants";
import { capture } from "../shared/notifications";
import { OAuth2, OAuth2DefaultImpl } from "./oauth2";
import Provider, { ConsumerHealthDataType } from "./provider";

export class Fitbit extends Provider implements OAuth2 {
  static URL = "https://api.fitbit.com";
  static AUTHORIZATION_URL = "https://www.fitbit.com";
  static AUTHORIZATION_PATH = "/oauth2/authorize";
  static TOKEN_PATH = "/oauth2/token";
  static REVOKE_PATH = "/oauth2/revoke";
  static API_PATH = "1/user/-";
  static scopes = [
    "activity",
    "cardio_fitness",
    "electrocardiogram",
    "heartrate",
    "location",
    "nutrition",
    "oxygen_saturation",
    "profile",
    "respiratory_rate",
    "settings",
    "sleep",
    "social",
    "temperature",
    "weight",
  ];

  private static clientId = Config.getFitbitClientId();
  private static clientSecret = Config.getFitbitClientSecret();

  constructor(
    private readonly oauth = new OAuth2DefaultImpl(
      PROVIDER_FITBIT,
      Fitbit.clientId,
      Fitbit.clientSecret,
      {
        authorizeHost: Fitbit.AUTHORIZATION_URL,
        tokenHost: Fitbit.URL,
        authorizePath: Fitbit.AUTHORIZATION_PATH,
        tokenPath: Fitbit.TOKEN_PATH,
        revokePath: Fitbit.REVOKE_PATH,
      },
      Fitbit.scopes
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

  async revokeProviderAccess(connectedUser: ConnectedUser) {
    return this.oauth.revokeProviderAccess(connectedUser);
  }

  override async getActivityData(connectedUser: ConnectedUser, date: string): Promise<Activity> {
    const params = {
      afterDate: date,
      offset: "0",
      limit: "100",
      sort: "asc",
    };

    const accessToken = await this.oauth.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Activity>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/activities/list.json`,
      accessToken,
      async resp => {
        return mapToActivity(fitbitActivityLogResp.parse(resp.data.activities), date);
      },
      params
    );
  }

  async fetchBreathingData(accessToken: string, date: string): Promise<FitbitBreathingRate> {
    return this.oauth.fetchProviderData<FitbitBreathingRate>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/br/date/${date}.json`,
      accessToken,
      async resp => {
        return fitbitBreathingRateResp.parse(resp.data.br[0]);
      }
    );
  }

  async fetchCardioData(accessToken: string, date: string): Promise<FitbitCardioScore> {
    return this.oauth.fetchProviderData<FitbitCardioScore>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/cardioscore/date/${date}.json`,
      accessToken,
      async resp => {
        return fitbitCardioScoreResp.parse(resp.data.cardioScore[0]);
      }
    );
  }

  async fetchHeartRateData(accessToken: string, date: string): Promise<FitbitHeartRate> {
    return this.oauth.fetchProviderData<FitbitHeartRate>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/activities/heart/date/${date}/1d.json?timezone=UTC`,
      accessToken,
      async resp => {
        return fitbitHeartRateResp.parse(resp.data["activities-heart"][0]);
      }
    );
  }

  async fetchHeartVariabilityData(
    accessToken: string,
    date: string
  ): Promise<FitbitHeartVariability> {
    return this.oauth.fetchProviderData<FitbitHeartVariability>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/hrv/date/${date}.json`,
      accessToken,
      async resp => {
        return fitbitHeartVariabilityResp.parse(resp.data.hrv[0]);
      }
    );
  }

  async fetchSpo2Data(accessToken: string, date: string): Promise<FitbitSpo2> {
    return this.oauth.fetchProviderData<FitbitSpo2>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/spo2/date/${date}.json`,
      accessToken,
      async resp => {
        return fitbitSpo2Resp.parse(resp.data);
      }
    );
  }

  async fetchTempCoreData(accessToken: string, date: string): Promise<FitbitTempCore> {
    return this.oauth.fetchProviderData<FitbitTempCore>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/temp/core/date/${date}.json`,
      accessToken,
      async resp => {
        return fitbitTempCoreResp.parse(resp.data.tempCore[0]);
      }
    );
  }

  async fetchTempSkinData(accessToken: string, date: string): Promise<FitbitTempSkin> {
    return this.oauth.fetchProviderData<FitbitTempSkin>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/temp/skin/date/${date}.json`,
      accessToken,
      async resp => {
        return fitbitTempSkinResp.parse(resp.data.tempSkin[0]);
      }
    );
  }

  override async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string
  ): Promise<Biometrics> {
    const accessToken = await this.oauth.getAccessToken(connectedUser);

    const [resBreathing, resCardio, resHr, resHrv, resSpo, resTempCore, resTempSkin] =
      await Promise.allSettled([
        this.fetchBreathingData(accessToken, date),
        this.fetchCardioData(accessToken, date),
        this.fetchHeartRateData(accessToken, date),
        this.fetchHeartVariabilityData(accessToken, date),
        this.fetchSpo2Data(accessToken, date),
        this.fetchTempCoreData(accessToken, date),
        this.fetchTempSkinData(accessToken, date),
      ]);

    const breathing = resBreathing.status === "fulfilled" ? resBreathing.value : undefined;
    const cardio = resCardio.status === "fulfilled" ? resCardio.value : undefined;
    const hr = resHr.status === "fulfilled" ? resHr.value : undefined;
    const hrv = resHrv.status === "fulfilled" ? resHrv.value : undefined;
    const spo = resSpo.status === "fulfilled" ? resSpo.value : undefined;
    const tempCore = resTempCore.status === "fulfilled" ? resTempCore.value : undefined;
    const tempSkin = resTempSkin.status === "fulfilled" ? resTempSkin.value : undefined;

    if (!breathing && !cardio && !hr && !hrv && !spo && !tempCore && !tempSkin) {
      throw new Error("All Requests failed");
    }
    return mapToBiometrics(date, breathing, cardio, hr, hrv, spo, tempCore, tempSkin);
  }

  async fetchUserProfile(
    accessToken: string,
    extraHeaders?: { [k: string]: string }
  ): Promise<FitbitUser> {
    return this.oauth.fetchProviderData<FitbitUser>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/profile.json`,
      accessToken,
      async resp => {
        return fitbitUserResp.parse(resp.data);
      },
      undefined,
      extraHeaders
    );
  }

  async fetchWeights(
    accessToken: string,
    date: string,
    extraHeaders?: { [k: string]: string }
  ): Promise<FitbitWeight> {
    return this.oauth.fetchProviderData<FitbitWeight>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/body/log/weight/date/${date}.json`,
      accessToken,
      async resp => {
        return weightSchema.parse(resp.data.weight);
      },
      undefined,
      extraHeaders
    );
  }

  override async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    const accessToken = await this.oauth.getAccessToken(connectedUser);

    const extraHeaders = {
      "Accept-Language": "en_GB", // For higher precision in weight readings, we are retrieving data in stones and converting it to kg
    };

    const [resUser, resWeight] = await Promise.allSettled([
      this.fetchUserProfile(accessToken, extraHeaders),
      this.fetchWeights(accessToken, date, extraHeaders),
    ]);

    const user = resUser.status === "fulfilled" ? resUser.value : undefined;
    const weight = resWeight.status === "fulfilled" ? resWeight.value : undefined;

    if (!user) {
      if (!weight) throw new Error("All Requests failed");
      throw new Error("User Request failed");
    }

    return mapToBody(date, user, weight);
  }

  async fetchFoodData(accessToken: string, date: string): Promise<FitbitFood> {
    return this.oauth.fetchProviderData<FitbitFood>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/foods/log/date/${date}.json`,
      accessToken,
      async resp => {
        return fitbitFoodResp.parse(resp.data);
      }
    );
  }

  async fetchWaterData(accessToken: string, date: string): Promise<FitbitWater> {
    return this.oauth.fetchProviderData<FitbitWater>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/foods/log/water/date/${date}.json`,
      accessToken,
      async resp => {
        return fitbitWaterResp.parse(resp.data);
      }
    );
  }

  override async getNutritionData(connectedUser: ConnectedUser, date: string): Promise<Nutrition> {
    const accessToken = await this.oauth.getAccessToken(connectedUser);

    const [resFood, resWater] = await Promise.allSettled([
      this.fetchFoodData(accessToken, date),
      this.fetchWaterData(accessToken, date),
    ]);

    const food = resFood.status === "fulfilled" ? resFood.value : undefined;
    const water = resWater.status === "fulfilled" ? resWater.value : undefined;

    if (!food && !water) {
      throw new Error("All Requests failed");
    }

    return mapToNutrition(date, food, water);
  }

  override async getSleepData(connectedUser: ConnectedUser, date: string): Promise<Sleep> {
    const accessToken = await this.oauth.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<Sleep>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/sleep/date/${date}.json`,
      accessToken,
      async resp => {
        return mapToSleep(fitbitSleepResp.parse(resp.data), date);
      }
    );
  }

  override async getUserData(connectedUser: ConnectedUser, date: string): Promise<User> {
    const accessToken = await this.oauth.getAccessToken(connectedUser);

    return this.oauth.fetchProviderData<User>(
      `${Fitbit.URL}/${Fitbit.API_PATH}/profile.json`,
      accessToken,
      async resp => {
        return mapToUser(fitbitUserResp.parse(resp.data), date);
      }
    );
  }

  async postAuth(token: string, userId?: string) {
    const accessToken = JSON.parse(token).access_token;

    const scopes = JSON.parse(token).scope;

    const subscriptionTypes: Record<FitbitScopes, FitbitCollectionTypesWithoutUserRevokedAccess> = {
      [FitbitScopes.activity]: "activities",
      [FitbitScopes.nutrition]: "foods",
      [FitbitScopes.sleep]: "sleep",
      [FitbitScopes.weight]: "body",
    };

    const subscriptionId = userId;

    // TODO #652: Implement userRevokedAccess

    await Promise.all(
      Object.entries(subscriptionTypes).map(async ([key, subscriptionType]) => {
        if (scopes.includes(key)) {
          const subscriptionUrl = `${Fitbit.URL}/${Fitbit.API_PATH}/${subscriptionType}/apiSubscriptions/${subscriptionId}-${subscriptionType}.json`;
          this.createSubscription(subscriptionUrl, accessToken);
        }
      })
    );
  }

  // Creates a subscription for all or one specific collectionType
  async createSubscription(url: string, accessToken: string): Promise<void> {
    try {
      const resp = await axios.post(url, null, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Length": 0,
        },
      });
      console.log("Fitbit WH subscription created successfully.", resp.data);
    } catch (error) {
      console.log("createSubscription for Fitbit failed.");
      capture.error(error, {
        extra: { context: `fitbit.createSubscription`, url },
      });

      throw new Error(`WH subscription failed Fitbit`, { cause: error });
    }
  }
}
