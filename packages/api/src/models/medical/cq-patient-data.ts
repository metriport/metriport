import { DataTypes, Sequelize } from "sequelize";
import { CQData, PatientCQData } from "../../domain/medical/cq-patient-data";
import { BaseModel, ModelSetup } from "../_default";

export class PatientCQDataModel extends BaseModel<PatientCQDataModel> implements PatientCQData {
  static NAME = "patient_cq_data";
  declare id: string;
  declare cxId: string;
  declare data: CQData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientCQDataModel.init(
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
        tableName: PatientCQDataModel.NAME,
      }
    );
  };
}
