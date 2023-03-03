import { DataTypes, Sequelize } from "sequelize";
import { Config } from "../../shared/config";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";
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

export type OrganizationCreate = Omit<Organization, "id">;

export class Organization extends BaseModel<Organization> {
  static NAME = "organization";
  declare id: string;
  declare cxId: string;
  declare organizationNumber: number;
  declare data: OrganizationData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    Organization.init(
      {
        ...BaseModel.baseAttributes(),
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
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
        tableName: Organization.NAME,
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
  const curMaxNumber = (await Organization.max("organizationNumber")) as number;
  const orgNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;

  return {
    orgId: `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgNumber}`,
    orgNumber,
  };
}
