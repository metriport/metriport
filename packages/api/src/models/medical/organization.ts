import {
  Organization,
  OrganizationData,
  OrganizationBizType,
} from "@metriport/core/domain/organization";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";

export class OrganizationModel extends BaseModel<OrganizationModel> implements Organization {
  static NAME = "organization";
  declare cxId: string;
  declare oid: string;
  declare organizationNumber: number;
  declare type: OrganizationBizType;
  declare data: OrganizationData;
  declare cqActive: boolean;
  declare cwActive: boolean;
  declare cqApproved: boolean;
  declare cwApproved: boolean;

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
        type: {
          type: DataTypes.ENUM(...Object.values(OrganizationBizType)),
          defaultValue: OrganizationBizType.healthcareProvider,
        },
        data: {
          type: DataTypes.JSONB,
        },
        cqActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        cwActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        cqApproved: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        cwApproved: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: OrganizationModel.NAME,
      }
    );
  };
}
