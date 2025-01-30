import { Organization } from "@medplum/fhirtypes";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { CQDirectoryEntry } from "../cq-directory";

export const rootOrgColumnName = "root_organization";
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
  static NAME = "cq_directory_entry_view";
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
        active: {
          type: DataTypes.BOOLEAN,
        },
        rootOrganization: {
          type: DataTypes.STRING,
          field: rootOrgColumnName,
        },
        managingOrganizationId: {
          type: DataTypes.STRING,
          field: managingOrgIdColumnName,
        },
        data: {
          type: DataTypes.JSONB,
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
        lat: {
          type: DataTypes.FLOAT,
        },
        lon: {
          type: DataTypes.FLOAT,
        },
        point: {
          type: "CUBE",
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
