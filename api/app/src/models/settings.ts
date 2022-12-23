import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from "sequelize";
import { defaultModelOptions, ModelSetup } from "./_default";

export const DATE_FORMAT = "YYYY-MM";
export const WEBHOOK_STATUS_OK = "OK";
export const WEBHOOK_STATUS_BAD_RESPONSE = "Bad response from webhook call";

export class Settings extends Model<
  InferAttributes<Settings>,
  InferCreationAttributes<Settings>
> {
  static NAME: string = "settings";
  declare id: string;
  declare webhookUrl: string | null;
  declare webhookKey: string | null;
  declare webhookEnabled: boolean;
  declare webhookStatusDetail: string | null;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    Settings.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
        webhookUrl: {
          type: DataTypes.STRING,
        },
        webhookKey: {
          type: DataTypes.STRING,
        },
        webhookEnabled: {
          type: DataTypes.BOOLEAN,
        },
        webhookStatusDetail: {
          type: DataTypes.STRING,
        },
      },
      {
        ...defaultModelOptions(sequelize),
        tableName: Settings.NAME,
      }
    );
  };
}
