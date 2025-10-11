import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";
import { CwDirectoryEntryData } from "../cw-directory";

export class CwDirectoryEntryViewModel
  extends BaseModel<CwDirectoryEntryViewModel>
  implements CwDirectoryEntryData
{
  static NAME = "cw_directory_entry_view";

  declare id: string; // Organization's OID
  declare organizationName: string;
  declare organizationId: string;
  declare orgType: string;
  declare memberName: string;
  declare addressLine1: string;
  declare addressLine2?: string;
  declare city: string;
  declare state: string;
  declare zipCode: string;
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
        organizationName: {
          type: DataTypes.STRING,
          field: "organization_name",
        },
        organizationId: {
          type: DataTypes.STRING,
          field: "organization_id",
        },
        orgType: {
          type: DataTypes.STRING,
          field: "org_type",
        },
        memberName: {
          type: DataTypes.STRING,
          field: "member_name",
        },
        addressLine1: {
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
        zipCode: {
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
