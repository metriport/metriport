import { PatientCohortModelCreate } from "@metriport/shared/domain/cohort";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { CohortModel } from "./cohort";
import { PatientModel } from "./patient";
import { OrganizationModel } from "./organization";

export class PatientCohortModel
  extends BaseModel<PatientCohortModel>
  implements PatientCohortModelCreate
{
  static NAME = "patient_cohort";

  declare patientId: string;
  declare cohortId: string;
  declare cxId: string;

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
        cxId: {
          type: DataTypes.UUID,
          references: {
            model: OrganizationModel.NAME,
            key: "cx_id",
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
