import { Patient, PatientData } from "@metriport/core/domain/patient";
import { Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { PatientSettingsModel } from "../patient-settings";
import { initModel, patientTableName } from "./patient-shared";

export class PatientModelReadOnly extends BaseModel<PatientModelReadOnly> implements Patient {
  static NAME = patientTableName;
  declare cxId: string;
  declare facilityIds: string[];
  declare externalId?: string;
  declare hieOptOut?: boolean;
  declare data: PatientData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    const model = initModel(sequelize);
    PatientModelReadOnly.init(model.attributes, model.options);
  };

  static associate = (models: { PatientSettingsModel: typeof PatientSettingsModel }) => {
    PatientModelReadOnly.hasOne(models.PatientSettingsModel, {
      foreignKey: "patientId",
      sourceKey: "id",
    });
  };
}
