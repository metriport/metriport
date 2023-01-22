import { Activity, Biometrics, Body, Nutrition, Sleep, User } from "@metriport/api";

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

export type ConsumerHealthDataTypeMap = {
  [key in ConsumerHealthDataType]: boolean;
};
export default abstract class Provider {
  constructor(readonly supportedDataTypes: ConsumerHealthDataTypeMap) {}

  consumerHealthDataTypeSupported(dataType: ConsumerHealthDataType): boolean {
    return this.supportedDataTypes[dataType];
  }

  async getActivityData(connectedUser: ConnectedUser, date: string): Promise<Activity> {
    throw new NotImplementedError();
  }

  async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    throw new NotImplementedError();
  }

  async getBiometricsData(connectedUser: ConnectedUser, date: string): Promise<Biometrics> {
    throw new NotImplementedError();
  }

  async getNutritionData(connectedUser: ConnectedUser, date: string): Promise<Nutrition> {
    throw new NotImplementedError();
  }

  async getSleepData(connectedUser: ConnectedUser, date: string): Promise<Sleep> {
    throw new NotImplementedError();
  }

  async getUserData(connectedUser: ConnectedUser, date: string): Promise<User> {
    throw new NotImplementedError();
  }
}
