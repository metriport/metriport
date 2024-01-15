import { DataTypes, Sequelize } from "sequelize";
import { DocRefMapping } from "../../domain/medical/docref-mapping";
import { MedicalDataSource } from "@metriport/core/external/index";
import { BaseModel, ModelSetup } from "../_default";

export class DocRefMappingModel extends BaseModel<DocRefMappingModel> implements DocRefMapping {
  static NAME = "docref_mapping";
  declare externalId: string;
  declare cxId: string;
  declare patientId: string;
  declare source: MedicalDataSource;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocRefMappingModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        source: {
          type: DataTypes.STRING,
        },
        externalId: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: DocRefMappingModel.NAME,
      }
    );
  };
}
