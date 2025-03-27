import { DocumentQueryStatus } from "@metriport/core/domain/document-query";
import { DataTypes, Sequelize } from "sequelize";
import { DocumentQuery } from "../../domain/medical/document-query";
import { BaseModel, ModelSetup } from "../_default";

export class DocumentQueryModel extends BaseModel<DocumentQueryModel> implements DocumentQuery {
  static NAME = "document_query";
  declare id: string;
  declare requestId: string;
  declare cxId: string;
  declare patientId: string;
  declare isReconvert: boolean;
  declare isDownloadWebhookSent: boolean;
  declare isConvertWebhookSent: boolean;
  declare metaData: object | null;
  declare data: object | null;
  declare commonwellDownloadError: number;
  declare commonwellDownloadSuccess: number;
  declare commonwellDownloadTotal: number;
  declare commonwellDownloadStatus: DocumentQueryStatus | null;
  declare commonwellConvertError: number;
  declare commonwellConvertSuccess: number;
  declare commonwellConvertTotal: number;
  declare commonwellConvertStatus: DocumentQueryStatus | null;
  declare carequalityDownloadError: number;
  declare carequalityDownloadSuccess: number;
  declare carequalityDownloadTotal: number;
  declare carequalityDownloadStatus: DocumentQueryStatus | null;
  declare carequalityConvertError: number;
  declare carequalityConvertSuccess: number;
  declare carequalityConvertTotal: number;
  declare carequalityConvertStatus: DocumentQueryStatus | null;
  declare unknownDownloadError: number;
  declare unknownDownloadSuccess: number;
  declare unknownDownloadTotal: number;
  declare unknownDownloadStatus: DocumentQueryStatus | null;
  declare unknownConvertError: number;
  declare unknownConvertSuccess: number;
  declare unknownConvertTotal: number;
  declare unknownConvertStatus: DocumentQueryStatus | null;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocumentQueryModel.init(
      {
        ...BaseModel.attributes(),
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        requestId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        cxId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        patientId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        isReconvert: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        isDownloadWebhookSent: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        isConvertWebhookSent: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        metaData: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: null,
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: null,
        },
        commonwellDownloadError: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        commonwellDownloadSuccess: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        commonwellDownloadTotal: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        commonwellDownloadStatus: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        },
        commonwellConvertError: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        commonwellConvertSuccess: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        commonwellConvertTotal: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        commonwellConvertStatus: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        },
        carequalityDownloadError: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        carequalityDownloadSuccess: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        carequalityDownloadTotal: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        carequalityDownloadStatus: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        },
        carequalityConvertError: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        carequalityConvertSuccess: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        carequalityConvertTotal: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        carequalityConvertStatus: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        },
        unknownDownloadError: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        unknownDownloadSuccess: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        unknownDownloadTotal: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        unknownDownloadStatus: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        },
        unknownConvertError: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        unknownConvertSuccess: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        unknownConvertTotal: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        unknownConvertStatus: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: DocumentQueryModel.NAME,
      }
    );
  };
}
