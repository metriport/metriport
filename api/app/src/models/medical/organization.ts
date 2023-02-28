import { DataTypes, Sequelize } from "sequelize";
import { Organization as OrganizationType } from "@metriport/api";

import { Config } from "../../shared/config";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";

export type OrganizationData = Omit<OrganizationType, "id">;
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
            const curMaxNumber = (await Organization.max("organizationNumber")) as number;
            const orgNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
            attributes.id = `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgNumber}`;
            attributes.organizationNumber = orgNumber;
          },
        },
      }
    );
  };
}
