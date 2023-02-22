import { DataTypes, Sequelize } from "sequelize";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Config } from "../../shared/config";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";

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
            const org = await getOrganizationOrFail({ cxId: attributes.cxId });
            const facNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
            attributes.id = `${Config.getSystemRootOID()}.${OIDNode.organizations}.${
              org.organizationNumber
            }.${OIDNode.locations}.${facNumber}`;
            attributes.facilityNumber = facNumber;
          },
        },
      }
    );
  };
}
