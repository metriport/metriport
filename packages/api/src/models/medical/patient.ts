import { Patient, PatientData } from "@metriport/core/domain/patient";
import { Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { initModel, patientTableName } from "./patient-shared";

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
}
