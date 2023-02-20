import { DataTypes, Sequelize } from "sequelize";
import { Config } from "../../shared/config";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";

export class Organization extends BaseModel<Organization> {
  static NAME = "organization";
  declare id: string;
  declare cxId: string;
  declare organizationId: number;
  declare data: object;

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
        organizationId: {
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
            const curMaxId = (await Organization.max("organizationId")) as number;
            const orgId = curMaxId ? curMaxId + 1 : OID_ID_START;
            attributes.id = `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgId}`;
            attributes.organizationId = orgId;
          },
        },
      }
    );
  };
}
