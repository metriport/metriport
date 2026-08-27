import {
  Organization,
  OrganizationData,
  OrganizationBizType,
} from "@metriport/core/domain/organization";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { TcmEncounterModel } from "./tcm-encounter";

export class OrganizationModel extends BaseModel<OrganizationModel> implements Organization {
  static NAME = "organization";
  declare cxId: string;
  declare oid: string;
  declare organizationNumber: number;
  declare type: OrganizationBizType;
  declare data: OrganizationData;
  declare cqActive: boolean;
  declare cwActive: boolean;
  declare ehexActive: boolean;
  declare cqApproved: boolean;
  declare cwApproved: boolean;
  declare ehexApproved: boolean;
  declare principalOid: string | null;
  declare delegateOids: string[];

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
        ehexActive: {
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
        ehexApproved: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        principalOid: {
          type: DataTypes.STRING,
          defaultValue: null,
          allowNull: true,
        },
        delegateOids: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          defaultValue: [],
          allowNull: false,
          field: "delegate_oids",
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: OrganizationModel.NAME,
      }
    );
  };

  static associate = (models: { TcmEncounterModel: typeof TcmEncounterModel }) => {
    OrganizationModel.hasMany(models.TcmEncounterModel, {
      foreignKey: "cxId",
      sourceKey: "cxId",
    });
  };
}
