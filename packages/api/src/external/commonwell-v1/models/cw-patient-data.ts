import { DataTypes, Sequelize } from "sequelize";
import { CwData, CwPatientData } from "../cw-patient-data";
import { BaseModel, ModelSetup } from "../../../models/_default";

export class CwPatientDataModel extends BaseModel<CwPatientDataModel> implements CwPatientData {
  static NAME = "cw_patient_data";
  declare id: string;
  declare cxId: string;
  declare data: CwData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CwPatientDataModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CwPatientDataModel.NAME,
      }
    );
  };
}
