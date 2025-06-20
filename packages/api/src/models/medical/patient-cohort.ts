import { PatientCohort } from "@metriport/core/domain/cohort";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { CohortModel } from "./cohort";
import { PatientModel } from "./patient";

export class PatientCohortModel extends BaseModel<PatientCohortModel> implements PatientCohort {
  static NAME = "patient_cohort";

  declare patientId: string;
  declare cohortId: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientCohortModel.init(
      {
        ...BaseModel.attributes(),
        patientId: {
          type: DataTypes.UUID,
          references: {
            model: PatientModel.NAME,
            key: "id",
          },
        },
        cohortId: {
          type: DataTypes.UUID,
          references: {
            model: CohortModel.NAME,
            key: "id",
          },
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: this.NAME,
      }
    );
  };

  static associate = (models: { CohortModel: typeof CohortModel }) => {
    PatientCohortModel.belongsTo(models.CohortModel, {
      foreignKey: "cohortId",
      targetKey: "id",
      as: "Cohort",
    });
  };
}
