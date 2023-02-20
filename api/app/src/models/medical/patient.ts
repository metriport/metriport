import { DataTypes, Sequelize } from "sequelize";
import { Config } from "../../shared/config";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";
import { Organization } from "./organization";

export class Patient extends BaseModel<Patient> {
  static NAME = "patient";
  declare id: string;
  declare cxId: string;
  declare organizationId: number;
  declare facilityIds: number[];
  declare patientId: number;
  declare data: object;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    Patient.init(
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
          references: { model: Organization.NAME, key: "organization_id" },
        },
        facilityIds: {
          type: DataTypes.ARRAY(DataTypes.INTEGER),
        },
        patientId: {
          type: DataTypes.INTEGER,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...defaultModelOptions(sequelize),
        tableName: Patient.NAME,
        hooks: {
          async beforeCreate(attributes) {
            const curMaxId = (await Patient.max("patientId", {
              where: {
                organizationId: attributes.organizationId,
              },
            })) as number;
            const patientId = curMaxId ? curMaxId + 1 : OID_ID_START;
            attributes.id = `${Config.getSystemRootOID()}.${OIDNode.organizations}.${
              attributes.organizationId
            }.${OIDNode.patients}.${patientId}`;
            attributes.patientId = patientId;
          },
        },
      }
    );
    Patient.belongsTo(Organization);
  };
}
