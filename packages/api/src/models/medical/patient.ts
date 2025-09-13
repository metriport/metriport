import { Patient, PatientData } from "@metriport/core/domain/patient";
import { Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { initModel, patientTableName } from "./patient-shared";
import { PatientCohortModel } from "./patient-cohort";
import { TcmEncounterModel } from "./tcm-encounter";

export class PatientModel extends BaseModel<PatientModel> implements Patient {
  static NAME = patientTableName;
  declare cxId: string;
  declare facilityIds: string[];
  declare externalId?: string;
  declare hieOptOut?: boolean;
  declare data: PatientData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    const model = initModel(sequelize);
    PatientModel.init(model.attributes, model.options);
  };

  static associate = (models: {
    PatientCohortModel: typeof PatientCohortModel;
    TcmEncounterModel: typeof TcmEncounterModel;
  }) => {
    PatientModel.hasMany(models.PatientCohortModel, {
      foreignKey: "patientId",
      sourceKey: "id",
      as: "PatientCohort",
    });
    PatientModel.hasMany(models.TcmEncounterModel, {
      foreignKey: "patientId",
      sourceKey: "id",
    });
  };
}
