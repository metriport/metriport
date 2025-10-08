import { CohortColors, CohortModelCreate, CohortSettings } from "@metriport/shared/domain/cohort";
import { CreationOptional, DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { PatientCohortModel } from "./patient-cohort";

export class CohortModel extends BaseModel<CohortModel> implements CohortModelCreate {
  static NAME = "cohort";

  declare cxId: string;
  declare name: string;
  declare description: CreationOptional<string>;
  declare color: CohortColors;
  declare settings: CreationOptional<CohortSettings>;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CohortModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        name: {
          type: DataTypes.STRING,
        },
        description: {
          type: DataTypes.STRING,
          defaultValue: "",
        },
        color: {
          type: DataTypes.STRING,
        },
        settings: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: this.NAME,
      }
    );
  };

  static associate = (models: { PatientCohortModel: typeof PatientCohortModel }) => {
    CohortModel.hasMany(models.PatientCohortModel, {
      foreignKey: "cohortId",
      sourceKey: "id",
      as: "PatientCohort",
    });
  };
}
