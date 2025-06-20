import { PatientCohort } from "@metriport/core/domain/cohort";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";

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
        },
        cohortId: {
          type: DataTypes.UUID,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: this.NAME,
      }
    );
  };
}
