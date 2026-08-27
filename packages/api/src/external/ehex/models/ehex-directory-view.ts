import { Organization } from "@medplum/fhirtypes";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { EhexDirectoryEntry } from "../ehex-directory";
import {
  addressLineColumnName,
  lastUpdatedAtEhexColumnName,
  managingOrgIdColumnName,
  rootOrgColumnName,
  urlDqColumnName,
  urlDrColumnName,
  urlXcpdColumnName,
} from "./ehex-directory-columns";

export class EhexDirectoryEntryViewModel
  extends BaseModel<EhexDirectoryEntryViewModel>
  implements EhexDirectoryEntry
{
  static NAME = "ehex_directory_entry_view";
  declare id: string; // Organization's OID
  declare name?: string;
  declare active: boolean;
  declare rootOrganization?: string;
  declare managingOrganizationId?: string;
  declare data?: Organization;
  declare urlXcpd?: string;
  declare urlDq?: string;
  declare urlDr?: string;
  declare urlXdr?: string;
  declare lat?: number;
  declare lon?: number;
  declare point?: string;
  declare addressLine?: string;
  declare city?: string;
  declare state?: string;
  declare zip?: string;
  declare lastUpdatedAtEhex: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    EhexDirectoryEntryViewModel.init(
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
        urlXcpd: {
          type: DataTypes.STRING,
          field: urlXcpdColumnName,
          allowNull: true,
        },
        urlDq: {
          type: DataTypes.STRING,
          field: urlDqColumnName,
          allowNull: true,
        },
        urlDr: {
          type: DataTypes.STRING,
          field: urlDrColumnName,
          allowNull: true,
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
        lastUpdatedAtEhex: {
          type: DataTypes.STRING,
          field: lastUpdatedAtEhexColumnName,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: EhexDirectoryEntryViewModel.NAME,
      }
    );
  };
}
