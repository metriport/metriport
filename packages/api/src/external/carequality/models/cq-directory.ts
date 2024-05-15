import { Organization } from "@metriport/carequality-sdk/models/organization";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { CQDirectoryEntry } from "../cq-directory";

export class CQDirectoryEntryModel
  extends BaseModel<CQDirectoryEntryModel>
  implements CQDirectoryEntry
{
  static NAME = "cq_directory_entry";
  declare id: string; // Organization's OID
  declare name?: string;
  declare urlXCPD?: string;
  declare urlDQ?: string;
  declare urlDR?: string;
  declare lat?: number;
  declare lon?: number;
  declare point?: string;
  declare addressLine?: string;
  declare city?: string;
  declare state?: string;
  declare zip?: string;
  declare data?: Organization;
  declare managingOrganization?: string;
  declare managingOrganizationId?: string;
  declare gateway: boolean;
  declare active: boolean;
  declare lastUpdatedAtCQ: string;

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
          allowNull: true,
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
        addressLine: {
          type: DataTypes.STRING,
          field: "address_line",
        },
        city: {
          type: DataTypes.STRING,
        },
        state: {
          type: DataTypes.STRING,
        },
        zip: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
        point: {
          type: "CUBE",
        },
        managingOrganization: {
          type: DataTypes.STRING,
          field: "managing_organization",
        },
        managingOrganizationId: {
          type: DataTypes.STRING,
          field: "managing_organization_id",
        },
        gateway: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        active: {
          type: DataTypes.BOOLEAN,
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
