/* eslint-disable @typescript-eslint/no-unused-vars */
import { Activity, Biometrics, Body, Nutrition, Sleep, User } from "@metriport/api-sdk";

import NotImplementedError from "../errors/not-implemented";
import { ConnectedUser } from "../models/connected-user";

// represents each consumer health data endpoint
export enum ConsumerHealthDataType {
  Activity = "Activity",
  Body = "Body",
  Biometrics = "Biometrics",
  Nutrition = "Nutrition",
  Sleep = "Sleep",
  User = "User",
}

export type DAPIParams = {
  timezoneId?: string;
};

export type ConsumerHealthDataTypeMap = {
  [key in ConsumerHealthDataType]: boolean;
};
export default abstract class Provider {
  constructor(readonly supportedDataTypes: ConsumerHealthDataTypeMap) {}

  consumerHealthDataTypeSupported(dataType: ConsumerHealthDataType): boolean {
    return this.supportedDataTypes[dataType];
  }

  async getActivityData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Activity> {
    throw new NotImplementedError();
  }

  async getBodyData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Body> {
    throw new NotImplementedError();
  }

  async getBiometricsData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Biometrics> {
    throw new NotImplementedError();
  }

  async getNutritionData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Nutrition> {
    throw new NotImplementedError();
  }

  async getSleepData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<Sleep> {
    throw new NotImplementedError();
  }

  async getUserData(
    connectedUser: ConnectedUser,
    date: string,
    extraParams: DAPIParams
  ): Promise<User> {
    throw new NotImplementedError();
  }
}
