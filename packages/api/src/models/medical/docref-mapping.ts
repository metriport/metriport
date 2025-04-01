import { MedicalDataSource } from "@metriport/core/external/index";
import { DataTypes, Sequelize } from "sequelize";
import { DocRefMapping } from "../../domain/medical/docref-mapping";
import { BaseModel, ModelSetup } from "../_default";

/**
 * Exclusively to be used by getOrCreateDocRefMapping() in get-docref-mapping.ts
 */
export const docRefMappingModelColumns = {
  id: "id",
  externalId: "external_id",
  cxId: "cx_id",
  patientId: "patient_id",
  source: "source",
  requestId: "request_id",
  udpatedAt: "updated_at",
};

export class DocRefMappingModel extends BaseModel<DocRefMappingModel> implements DocRefMapping {
  static NAME = "docref_mapping";
  declare externalId: string;
  declare cxId: string;
  declare patientId: string;
  declare requestId: string;
  declare rawResource: string;
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
        requestId: {
          type: DataTypes.STRING,
        },
        rawResource: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: DocRefMappingModel.NAME,
      }
    );
  };
}
