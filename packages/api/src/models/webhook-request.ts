import { DataTypes, Sequelize } from "sequelize";
import { WebhookRequestStatus } from "../domain/webhook";
import { BaseModel, ModelSetup } from "./_default";

export class WebhookRequest extends BaseModel<WebhookRequest> {
  static NAME = "webhook_request";
  declare id: string;
  declare cxId: string;
  declare requestId?: string;
  declare type: string; // intentionally 'string' to avoid circular dependency and coupling
  declare payload: object;
  declare status: WebhookRequestStatus;
  declare statusDetail?: string;
  declare requestUrl?: string;
  declare httpStatus?: number;
  declare durationMillis?: number;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    WebhookRequest.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.STRING,
        },
        requestId: {
          type: DataTypes.STRING,
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
        statusDetail: {
          type: DataTypes.STRING,
        },
        requestUrl: {
          type: DataTypes.STRING,
        },
        httpStatus: {
          type: DataTypes.INTEGER,
        },
        durationMillis: {
          type: DataTypes.INTEGER,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: WebhookRequest.NAME,
      }
    );
  };
}
