import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from "sequelize";
import { defaultModelOptions, ModelSetup } from "./_default";

export type WebhookRequestStatus = "processing" | "success" | "failure";

export class WebhookRequest extends Model<
  InferAttributes<WebhookRequest>,
  InferCreationAttributes<WebhookRequest>
> {
  static NAME: string = "webhook_request";
  declare id: string;
  declare cxId: string;
  declare payload: unknown;
  declare status: WebhookRequestStatus;
  declare statusAt: Date;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    WebhookRequest.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.STRING,
        },
        payload: {
          type: DataTypes.JSONB,
        },
        status: {
          type: DataTypes.STRING,
        },
        statusAt: {
          type: DataTypes.STRING,
        },
      },
      {
        ...defaultModelOptions(sequelize),
        tableName: WebhookRequest.NAME,
      }
    );
  };
}
