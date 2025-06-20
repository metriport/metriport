import { Cohort, MonitoringSettings } from "@metriport/core/domain/cohort";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { PatientCohortModel } from "./patient-cohort";

export class CohortModel extends BaseModel<CohortModel> implements Cohort {
  static NAME = "cohort";

  declare cxId: string;
  declare name: string;
  declare monitoring?: MonitoringSettings;

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
        monitoring: {
          type: DataTypes.JSONB,
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
