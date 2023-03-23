import { DataTypes, Sequelize } from "sequelize";
import { Config } from "../../shared/config";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, IBaseModel, ModelSetup } from "../_default";
import { Address } from "./address";

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
  location: Address;
};

export type OrganizationCreate = Omit<OrganizationModel, "id">;

export interface Organization extends IBaseModel {
  cxId: string;
  organizationNumber: number;
  data: OrganizationData;
}

export class OrganizationModel extends BaseModel<OrganizationModel> implements Organization {
  static NAME = "organization";
  declare cxId: string;
  declare organizationNumber: number;
  declare data: OrganizationData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    OrganizationModel.init(
      {
        ...BaseModel.baseAttributes(),
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
        ...defaultModelOptions(sequelize),
        tableName: OrganizationModel.NAME,
        hooks: {
          async beforeCreate(attributes) {
            const { orgId, orgNumber } = await createOrgId();
            attributes.id = orgId;
            attributes.organizationNumber = orgNumber;
          },
        },
      }
    );
  };
}

async function createOrgId() {
  const curMaxNumber = (await OrganizationModel.max("organizationNumber")) as number;
  const orgNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;

  return {
    orgId: `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgNumber}`,
    orgNumber,
  };
}
