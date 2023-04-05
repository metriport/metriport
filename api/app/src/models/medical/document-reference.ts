import { DataTypes, Sequelize } from "sequelize";
import { ExternalDocumentReference } from "../../domain/medical/document-reference";
import { MedicalDataSource } from "../../external";
import { BaseModel, ModelSetup } from "../_default";

export type DocumentReferenceData = ExternalDocumentReference;

export class DocumentReferenceModel extends BaseModel<DocumentReferenceModel> {
  static NAME = "document_reference";
  declare cxId: string;
  declare patientId: string;
  declare source: MedicalDataSource;
  declare externalId: string;
  declare data: DocumentReferenceData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocumentReferenceModel.init(
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
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: DocumentReferenceModel.NAME,
      }
    );
  };
}
