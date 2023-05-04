import { DataTypes, Sequelize } from "sequelize";
import { BaseDomain, BaseDomainCreate } from "../../domain/base-domain";
import { BaseModel, ModelSetup } from "../_default";
import { LocationAddress } from "./location-address";

export enum OrgType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
}

export type OrganizationData = {
  name: string;
  type: OrgType;
  location: LocationAddress;
};

export interface OrganizationCreate extends BaseDomainCreate {
  cxId: string;
  organizationNumber: number;
  data: OrganizationData;
}

export interface Organization extends BaseDomain, OrganizationCreate {}

export class OrganizationModel extends BaseModel<OrganizationModel> implements Organization {
  static NAME = "organization";
  declare cxId: string;
  declare organizationNumber: number;
  declare data: OrganizationData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    OrganizationModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
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
