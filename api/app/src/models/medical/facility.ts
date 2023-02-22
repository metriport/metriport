import { DataTypes, Sequelize } from "sequelize";
import { OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";
import { Organization } from "./organization";

export class Facility extends BaseModel<Facility> {
  static NAME = "facility";
  declare id: string;
  declare cxId: string;
  declare facilityNumber: number;
  declare data: object;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    Facility.init(
      {
        ...BaseModel.baseAttributes(),
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.UUID,
        },
        facilityNumber: {
          type: DataTypes.INTEGER,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...defaultModelOptions(sequelize),
        tableName: Facility.NAME,
        hooks: {
          async beforeCreate(attributes) {
            const curMaxNumber = (await Facility.max("facilityNumber", {
              where: {
                cxId: attributes.cxId,
              },
            })) as number;
            const facId = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
            attributes.id += `${facId}`;
          },
        },
      }
    );
    Facility.belongsTo(Organization);
  };
}
