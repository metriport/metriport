import { DataTypes, Sequelize } from "sequelize";
import { CQDirectoryEntry } from "../../external/carequality/domain/cq-directory";
import { BaseModel, ModelSetup } from "../../models/_default";
import { Organization } from "@metriport/carequality-sdk/models/organization";

export class CQDirectoryEntryModel
  extends BaseModel<CQDirectoryEntryModel>
  implements CQDirectoryEntry
{
  static NAME = "cq_directory_entry";
  declare id: string; // Organization's OID
  declare name?: string;
  declare urlXCPD: string;
  declare urlDQ?: string;
  declare urlDR?: string;
  declare lastUpdatedAtCQ: string;
  declare lat?: number;
  declare lon?: number;
  declare point?: string;
  declare state?: string;
  declare data?: Organization;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CQDirectoryEntryModel.init(
      {
        ...BaseModel.attributes(),
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
        lat: {
          type: DataTypes.FLOAT,
        },
        lon: {
          type: DataTypes.FLOAT,
        },
        state: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
        point: {
          type: "CUBE",
        },
        lastUpdatedAtCQ: {
          type: DataTypes.STRING,
          field: "last_updated_at_cq",
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CQDirectoryEntryModel.NAME,
      }
    );
  };
}
