import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { CwDirectoryEntryData } from "../cw-directory";

export class CwDirectoryEntryViewModel
  extends BaseModel<CwDirectoryEntryViewModel>
  implements CwDirectoryEntryData
{
  static NAME = "cw_directory_entry_view";

  declare id: string; // Organization's OID
  declare name: string;
  declare oid: string;
  declare orgType: string;
  declare rootOrganization: string;
  declare addressLine: string;
  declare addressLine2?: string;
  declare city: string;
  declare state: string;
  declare zip: string;
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
          field: "organization_name",
        },
        oid: {
          type: DataTypes.STRING,
          field: "organization_id",
        },
        orgType: {
          type: DataTypes.STRING,
          field: "org_type",
        },
        rootOrganization: {
          type: DataTypes.STRING,
          field: "member_name",
        },
        addressLine: {
          type: DataTypes.STRING,
          field: "address_line1",
        },
        addressLine2: {
          type: DataTypes.STRING,
          field: "address_line2",
        },
        city: {
          type: DataTypes.STRING,
        },
        state: {
          type: DataTypes.STRING,
        },
        zip: {
          type: DataTypes.STRING,
          field: "zip_code",
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
