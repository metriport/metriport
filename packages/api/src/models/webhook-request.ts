import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "./_default";

export type WebhookRequestStatus = "processing" | "success" | "failure";

export class WebhookRequest extends BaseModel<WebhookRequest> {
  static NAME = "webhook_request";
  declare id: string;
  declare cxId: string;
  declare requestId?: string;
  declare type: string; // intentionally 'string' to avoid circular dependency and coupling
  declare payload: object;
  declare status: WebhookRequestStatus;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    WebhookRequest.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.STRING,
        },
        requestId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        type: {
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
        ...BaseModel.modelOptions(sequelize),
        tableName: WebhookRequest.NAME,
      }
    );
  };
}
