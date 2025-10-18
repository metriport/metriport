import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { CwDirectoryEntryData } from "../cw-directory";

export class CwDirectoryEntryViewModel
  extends BaseModel<CwDirectoryEntryViewModel>
  implements CwDirectoryEntryData
{
  static NAME = "cw_directory_entry_view";

  declare id: string;
  declare name: string;
  declare oid: string;
  declare orgType: string;
  declare rootOrganization: string;
  declare addressLine: string;
  declare city: string | undefined;
  declare state: string | undefined;
  declare zip: string | undefined;
  declare country: string;
  declare data: unknown;
  declare active: boolean;
  declare npi?: string;
  static setup: ModelSetup = (sequelize: Sequelize) => {
    CwDirectoryEntryViewModel.init(
      {
        ...BaseModel.attributes(),
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
        },
        oid: {
          type: DataTypes.STRING,
        },
        orgType: {
          type: DataTypes.STRING,
          field: "org_type",
        },
        rootOrganization: {
          type: DataTypes.STRING,
          field: "root_organization",
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
        country: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
        active: {
          type: DataTypes.BOOLEAN,
        },
        npi: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CwDirectoryEntryViewModel.NAME,
      }
    );
  };
}
