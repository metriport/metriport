import { PatientImportMapping } from "@metriport/shared/domain/patient/patient-import/mapping";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";

export class PatientImportMappingModel
  extends BaseModel<PatientImportMappingModel>
  implements PatientImportMapping
{
  static NAME = "patient_import_mapping";
  declare cxId: string;
  declare jobId: string;
  declare rowNumber: number;
  declare patientId: string;
  declare dataPipelineRequestId: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientImportMappingModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.STRING,
        },
        jobId: {
          type: DataTypes.STRING,
        },
        rowNumber: {
          type: DataTypes.INTEGER,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        dataPipelineRequestId: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientImportMappingModel.NAME,
      }
    );
  };
}
