import { DataTypes, Sequelize } from "sequelize";
import { OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";
import { Organization } from "./organization";

export class Patient extends BaseModel<Patient> {
  static NAME = "patient";
  declare id: string;
  declare cxId: string;
  declare facilityIds: string[];
  declare patientNumber: number;
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
        facilityIds: {
          type: DataTypes.ARRAY(DataTypes.STRING),
        },
        patientNumber: {
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
            const curMaxNumber = (await Patient.max("patientNumber", {
              where: {
                cxId: attributes.cxId,
              },
            })) as number;
            const patientNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
            attributes.id += `${patientNumber}`;
            attributes.patientNumber = patientNumber;
          },
        },
      }
    );
    Patient.belongsTo(Organization);
  };
}
