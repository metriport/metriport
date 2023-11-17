import { DataTypes, Sequelize } from "sequelize";
import { CQOrganization } from "../../domain/medical/cq-directory";
import { BaseModel, ModelSetup } from "../../models/_default";
import { Organization } from "@metriport/carequality-sdk/models/organization";

export class CQDirectoryModel extends BaseModel<CQDirectoryModel> implements CQOrganization {
  static NAME = "cq_directory";
  declare oid: string;
  declare name?: string;
  declare urlXCPD: string;
  declare urlDQ?: string;
  declare urlDR?: string;
  declare latitude?: string;
  declare longitude?: string;
  declare data?: Organization;
  declare state?: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CQDirectoryModel.init(
      {
        ...BaseModel.attributes(),
        oid: {
          type: DataTypes.STRING,
        },
        name: {
          type: DataTypes.STRING,
        },
        urlXCPD: {
          type: DataTypes.STRING,
          field: "url_xcpd",
        },
        urlDQ: {
          type: DataTypes.STRING,
          field: "url_dq",
        },
        urlDR: {
          type: DataTypes.STRING,
          field: "url_dr",
        },
        latitude: {
          type: DataTypes.STRING,
        },
        longitude: {
          type: DataTypes.STRING,
        },
        state: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CQDirectoryModel.NAME,
      }
    );
  };
}
