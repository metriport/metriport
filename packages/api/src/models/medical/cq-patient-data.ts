import { DataTypes, Sequelize } from "sequelize";
import { CQData, CQPatientData } from "../../external/carequality/domain/cq-patient-data";
import { BaseModel, ModelSetup } from "../_default";

export class CQPatientDataModel extends BaseModel<CQPatientDataModel> implements CQPatientData {
  static NAME = "cq_patient_data";
  declare id: string;
  declare cxId: string;
  declare data: CQData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CQPatientDataModel.init(
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
        tableName: CQPatientDataModel.NAME,
      }
    );
  };
}
