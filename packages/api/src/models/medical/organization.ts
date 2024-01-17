import { DataTypes, Sequelize } from "sequelize";
import { Organization, OrganizationData } from "@metriport/core/domain/organization";
import { BaseModel, ModelSetup } from "../../models/_default";

export class OrganizationModel extends BaseModel<OrganizationModel> implements Organization {
  static NAME = "organization";
  declare cxId: string;
  declare oid: string;
  declare organizationNumber: number;
  declare data: OrganizationData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    OrganizationModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        oid: {
          type: DataTypes.STRING,
        },
        organizationNumber: {
          type: DataTypes.INTEGER,
          unique: true,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: OrganizationModel.NAME,
      }
    );
  };
}
