import { DataTypes, Sequelize } from "sequelize";
import { Suspect, ResponsibleResources } from "../domain/suspect";
import { BaseModel, ModelSetup } from "./_default";

export class SuspectModel extends BaseModel<SuspectModel> implements Suspect {
  static NAME = "suspect";
  declare cxId: string;
  declare patientId: string;
  declare suspectGroup: string;
  declare suspectIcd10Code: string | null;
  declare suspectIcd10ShortDescription: string | null;
  declare responsibleResources: ResponsibleResources;
  declare lastRun: Date;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    SuspectModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.STRING,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        suspectGroup: {
          type: DataTypes.STRING,
        },
        suspectIcd10Code: {
          type: DataTypes.STRING,
        },
        suspectIcd10ShortDescription: {
          type: DataTypes.STRING,
        },
        responsibleResources: {
          type: DataTypes.JSONB,
        },
        lastRun: {
          type: DataTypes.DATE,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: SuspectModel.NAME,
      }
    );
  };
}
