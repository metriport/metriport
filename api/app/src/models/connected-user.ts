import { DataTypes, Sequelize } from "sequelize";
import { ProviderOptions } from "../shared/constants";
import { BaseModel, defaultModelOptions, ModelSetup } from "./_default";

export type ProviderMapItem = {
  token: string; // user authorization token
  secret?: string; // user authorization secret (OAuth1)
  scopes?: string[]; // scopes authorized to be accessed by this app
};

export type ProviderMap = {
  [k in ProviderOptions]?: ProviderMapItem;
};

export class ConnectedUser extends BaseModel<ConnectedUser> {
  static NAME: string = "connected_user";
  declare id: string;
  declare cxId: string;
  declare cxUserId: string;
  declare providerMap?: ProviderMap;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    ConnectedUser.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
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
        ...defaultModelOptions(sequelize),
        tableName: ConnectedUser.NAME,
      }
    );
  };
}
