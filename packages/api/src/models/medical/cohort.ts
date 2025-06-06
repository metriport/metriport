import { Cohort, CohortAssignment, MonitoringSettings } from "@metriport/core/domain/cohort";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, BaseModelNoId, ModelSetup } from "../_default";

export class CohortModel extends BaseModel<CohortModel> implements Cohort {
  static NAME = "cohort";

  declare cxId: string;
  declare name: string;
  declare monitoring?: MonitoringSettings;
  declare otherSettings?: Record<string, unknown>;

  static override attributes() {
    return {
      ...super.attributes(),
      cxId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      monitoring: {
        type: DataTypes.JSONB,
      },
      otherSettings: {
        type: DataTypes.JSONB,
      },
    };
  }

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CohortModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        monitoring: {
          type: DataTypes.JSONB,
        },
        otherSettings: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: this.NAME,
      }
    );
  };
}

export class CohortAssignmentModel
  extends BaseModelNoId<CohortAssignmentModel>
  implements CohortAssignment
{
  static NAME = "patient_cohort";

  declare patientId: string;
  declare cohortId: string;

  static override attributes() {
    return {
      patientId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "patient_id",
        primaryKey: true,
        references: {
          model: "patient",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      cohortId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "cohort_id",
        primaryKey: true,
        references: {
          model: "cohort",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      ...BaseModelNoId.attributes(),
    };
  }

  static override modelOptions(sequelize: Sequelize) {
    return {
      ...super.modelOptions(sequelize),
      tableName: this.NAME,
    };
  }

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CohortAssignmentModel.init(
      CohortAssignmentModel.attributes(),
      CohortAssignmentModel.modelOptions(sequelize)
    );
  };
}
