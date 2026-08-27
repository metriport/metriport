import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { EhexData, EhexPatientData } from "../ehex-patient-data";

export class EhexPatientDataModel
  extends BaseModel<EhexPatientDataModel>
  implements EhexPatientData
{
  static NAME = "ehex_patient_data";
  declare id: string;
  declare cxId: string;
  declare data: EhexData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    EhexPatientDataModel.init(
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
        tableName: EhexPatientDataModel.NAME,
      }
    );
  };
}
