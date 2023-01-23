import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, defaultModelOptions, ModelSetup } from "./_default";

export type WebhookRequestStatus = "processing" | "success" | "failure";

export class WebhookRequest extends BaseModel<WebhookRequest> {
  static NAME = "webhook_request";
  declare id: string;
  declare cxId: string;
  declare payload: unknown;
  declare status: WebhookRequestStatus;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    WebhookRequest.init(
      {
        ...BaseModel.baseAttributes(),
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
      },
      {
        ...defaultModelOptions(sequelize),
        tableName: WebhookRequest.NAME,
      }
    );
  };
}
