import { Organization } from "@metriport/carequality-sdk/models/organization";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { CQDirectoryEntry } from "../cq-directory";

// TODO  2553 Rename this to root_organization on the second release
export const rootOrgColumnName = "managing_organization";
export const managingOrgIdColumnName = "managing_organization_id";
export const urlXcpdColumnName = "url_xcpd";
export const urlDqColumnName = "url_dq";
export const urlDrColumnName = "url_dr";
export const addressLineColumnName = "address_line";
export const lastUpdatedAtCqColumnName = "last_updated_at_cq";

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
  declare rootOrganization?: string;
  declare managingOrganizationId?: string;
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
          field: urlXcpdColumnName,
          allowNull: true,
        },
        urlDQ: {
          type: DataTypes.STRING,
          field: urlDqColumnName,
        },
        urlDR: {
          type: DataTypes.STRING,
          field: urlDrColumnName,
        },
        lat: {
          type: DataTypes.FLOAT,
        },
        lon: {
          type: DataTypes.FLOAT,
        },
        addressLine: {
          type: DataTypes.STRING,
          field: addressLineColumnName,
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
        rootOrganization: {
          type: DataTypes.STRING,
          field: rootOrgColumnName,
        },
        managingOrganizationId: {
          type: DataTypes.STRING,
          field: managingOrgIdColumnName,
        },
        active: {
          type: DataTypes.BOOLEAN,
        },
        lastUpdatedAtCQ: {
          type: DataTypes.STRING,
          field: lastUpdatedAtCqColumnName,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CQDirectoryEntryModel.NAME,
      }
    );
  };
}
