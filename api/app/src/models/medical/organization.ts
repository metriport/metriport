import { DataTypes, Sequelize } from "sequelize";
import { Organization as OrganizationType } from "../../routes/medical/models/organization";

import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";
import { createOrgId } from "../../shared/oid";

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
            const { orgId, orgNumber } = await createOrgId();

            attributes.id = orgId;
            attributes.organizationNumber = orgNumber;
          },
        },
      }
    );
  };
}
