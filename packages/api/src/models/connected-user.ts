import { DataTypes, Sequelize } from "sequelize";
import { ProviderOptions } from "../shared/constants";
import { BaseModel, ModelSetup } from "./_default";

export type ProviderMapItem = {
  token: string; // user authorization token
  secret?: string; // user authorization secret (OAuth1)
  scopes?: string[]; // scopes authorized to be accessed by this app
  connectedDeviceIds?: string[]; // list of connected devices
  deviceUserId?: string; // id used in other services
};

export type ProviderMap = {
  [k in ProviderOptions]?: ProviderMapItem;
};

export class ConnectedUser extends BaseModel<ConnectedUser> {
  static NAME = "connected_user";
  declare cxId: string;
  declare cxUserId: string;
  declare providerMap?: ProviderMap;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    ConnectedUser.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        cxUserId: {
          type: DataTypes.STRING,
        },
        providerMap: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: ConnectedUser.NAME,
      }
    );
  };
}
