import { DataTypes, Sequelize } from "sequelize";
import { FeedbackEntry } from "../domain/feedback";
import { BaseModel, ModelSetup } from "./_default";

export class FeedbackEntryModel extends BaseModel<FeedbackEntryModel> implements FeedbackEntry {
  static NAME = "feedback_entry";
  declare feedbackId: string;
  declare comment: string;
  declare authorName: string | undefined;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    FeedbackEntryModel.init(
      {
        ...BaseModel.attributes(),
        feedbackId: {
          type: DataTypes.UUID,
        },
        comment: {
          type: DataTypes.STRING,
        },
        authorName: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: FeedbackEntryModel.NAME,
      }
    );
  };
}
