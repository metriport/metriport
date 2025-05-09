import { Organization } from "@medplum/fhirtypes";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { CQDirectoryEntry } from "../cq-directory";
import {
  addressLineColumnName,
  lastUpdatedAtCqColumnName,
  managingOrgIdColumnName,
  rootOrgColumnName,
  urlDqColumnName,
  urlDrColumnName,
  urlXcpdColumnName,
} from "./cq-directory-columns";

export class CQDirectoryEntryViewModel
  extends BaseModel<CQDirectoryEntryViewModel>
  implements CQDirectoryEntry
{
  static NAME = "cq_directory_entry_view";
  declare id: string; // Organization's OID
  declare name?: string;
  declare active: boolean;
  declare rootOrganization?: string;
  declare managingOrganizationId?: string;
  declare data?: Organization;
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
  declare lastUpdatedAtCQ: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CQDirectoryEntryViewModel.init(
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
        tableName: CQDirectoryEntryViewModel.NAME,
      }
    );
  };
}
