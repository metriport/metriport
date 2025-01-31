import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";

export class HIEDirectoryEntryViewModel extends BaseModel<HIEDirectoryEntryViewModel> {
  static NAME = "hie_directory_view";

  declare id: string; // Organization's OID
  declare name?: string;
  declare active: boolean;
  declare rootOrganization?: string;
  declare managingOrganizationId?: string;
  declare addressLine?: string;
  declare city?: string;
  declare state?: string;
  declare zip?: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    HIEDirectoryEntryViewModel.init(
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
          field: "root_organization",
        },
        managingOrganizationId: {
          type: DataTypes.STRING,
          field: "managing_organization_id",
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
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: HIEDirectoryEntryViewModel.NAME,
      }
    );
  };
}
