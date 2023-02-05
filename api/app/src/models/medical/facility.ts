import { DataTypes, Sequelize } from "sequelize";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";
import { Organization } from "./organization";

export class Facility extends BaseModel<Facility> {
  static NAME = "facility";
  declare id: number;
  declare organizationId: number;
  declare systemRootOid: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    Facility.init(
      {
        ...BaseModel.baseAttributes(),
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        organizationId: {
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
        tableName: Facility.NAME,
        hooks: {
          async beforeCreate(attributes) {
            const curMaxId = (await Facility.max("id", {
              where: {
                systemRootOid: attributes.systemRootOid,
                organizationId: attributes.organizationId,
              },
            })) as number;
            attributes.id = curMaxId ? (attributes.id = curMaxId + 1) : OID_ID_START;
          },
        },
      }
    );
    Facility.belongsTo(Organization);
  };

  oid(): string {
    return `${this.systemRootOid}.${OIDNode.organizations}.${this.organizationId}.${OIDNode.locations}.${this.id}`;
  }
}
