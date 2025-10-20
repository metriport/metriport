import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../../../models/_default";

export class HIEDirectoryEntryViewModel extends BaseModel<HIEDirectoryEntryViewModel> {
  static NAME = "hie_directory_view";

  declare oid: string;
  declare name: string;
  declare active: boolean;
  declare rootOrganization?: string;
  declare managingOrganizationId?: string;
  declare addressLine?: string;
  declare city?: string;
  declare state?: string;
  declare zipCode?: string;
  declare network: "COMMONWELL" | "CAREQUALITY";

  static setup: ModelSetup = (sequelize: Sequelize) => {
    HIEDirectoryEntryViewModel.init(
      {
        ...BaseModel.attributes(),
        id: {
          type: DataTypes.STRING,
          field: "id",
          primaryKey: true,
        },
        oid: {
          type: DataTypes.STRING,
          field: "oid",
          primaryKey: true,
        },
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
        network: {
          type: DataTypes.STRING,
          field: "network",
          validate: {
            isIn: [["COMMONWELL", "CAREQUALITY"]],
          },
        },
        state: {
          type: DataTypes.STRING,
        },
        zipCode: {
          type: DataTypes.STRING,
          field: "zip_code",
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: HIEDirectoryEntryViewModel.NAME,
      }
    );
  };
}
