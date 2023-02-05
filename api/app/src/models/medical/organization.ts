import { DataTypes, Sequelize } from "sequelize";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";

export class Organization extends BaseModel<Organization> {
  static NAME = "organization";
  declare id: number;
  declare systemRootOid: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    Organization.init(
      {
        ...BaseModel.baseAttributes(),
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        systemRootOid: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
      },
      {
        ...defaultModelOptions(sequelize),
        tableName: Organization.NAME,
        hooks: {
          async beforeCreate(attributes) {
            const curMaxId = (await Organization.max("id", {
              where: { systemRootOid: attributes.systemRootOid },
            })) as number;
            console.log(curMaxId);
            attributes.id = curMaxId ? (attributes.id = curMaxId + 1) : OID_ID_START;
          },
        },
      }
    );
  };

  oid(): string {
    return `${this.systemRootOid}.${OIDNode.organizations}.${this.id}`;
  }
}
