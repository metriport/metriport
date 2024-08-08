import { DataTypes, Sequelize } from "sequelize";
import { Feedback, FeedbackData } from "../domain/feedback";
import { BaseModel, ModelSetup } from "./_default";

export class FeedbackModel extends BaseModel<FeedbackModel> implements Feedback {
  static NAME = "feedback";
  declare cxId: string;
  declare entityId: string;
  declare data: FeedbackData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    FeedbackModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        entityId: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: FeedbackModel.NAME,
      }
    );
  };
}
