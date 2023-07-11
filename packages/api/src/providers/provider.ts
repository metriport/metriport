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

export type ConsumerHealthDataTypeMap = {
  [key in ConsumerHealthDataType]: boolean;
};
export default abstract class Provider {
  constructor(readonly supportedDataTypes: ConsumerHealthDataTypeMap) {}

  consumerHealthDataTypeSupported(dataType: ConsumerHealthDataType): boolean {
    return this.supportedDataTypes[dataType];
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getActivityData(connectedUser: ConnectedUser, date: string): Promise<Activity> {
    throw new NotImplementedError();
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBodyData(connectedUser: ConnectedUser, date: string): Promise<Body> {
    throw new NotImplementedError();
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBiometricsData(connectedUser: ConnectedUser, date: string): Promise<Biometrics> {
    throw new NotImplementedError();
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getNutritionData(connectedUser: ConnectedUser, date: string): Promise<Nutrition> {
    throw new NotImplementedError();
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSleepData(connectedUser: ConnectedUser, date: string): Promise<Sleep> {
    throw new NotImplementedError();
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getUserData(connectedUser: ConnectedUser, date: string): Promise<User> {
    throw new NotImplementedError();
  }
}
