import { Patient, PatientData } from "@metriport/core/domain/patient";
import { Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { CohortModel } from "./cohort";
import { PatientCohortModel } from "./patient-cohort";
import { initModel, patientTableName } from "./patient-shared";

export class PatientModelReadOnly extends BaseModel<PatientModelReadOnly> implements Patient {
  static NAME = patientTableName;
  declare cxId: string;
  declare facilityIds: string[];
  declare externalId?: string;
  declare hieOptOut?: boolean;
  declare data: PatientData;
  declare Cohorts?: CohortModel[];

  static setup: ModelSetup = (sequelize: Sequelize) => {
    const model = initModel(sequelize);
    PatientModelReadOnly.init(model.attributes, model.options);
  };

  static associate = (models: {
    CohortModel: typeof CohortModel;
    PatientCohortModel: typeof PatientCohortModel;
  }) => {
    PatientModelReadOnly.belongsToMany(models.CohortModel, {
      through: models.PatientCohortModel,
      foreignKey: "patientId",
      otherKey: "cohortId",
      as: "Cohorts",
    });
  };
}
