import { DataTypes, Sequelize } from "sequelize";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Config } from "../../shared/config";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";
import { LinkSource } from "../../routes/medical/schemas/link";

export type LinkMapItem = {
  cw_link_id: string;
  cw_person_id: string;
};

export type LinkData = {
  [k in LinkSource]?: LinkMapItem;
};

export class Patient extends BaseModel<Patient> {
  static NAME = "patient";
  declare id: string;
  declare cxId: string;
  declare facilityIds: string[];
  declare patientNumber: number;
  declare data: object;
  declare linkData: LinkData;

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
        linkData: {
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
            const org = await getOrganizationOrFail({ cxId: attributes.cxId });
            const patientNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
            attributes.id = `${Config.getSystemRootOID()}.${OIDNode.organizations}.${
              org.organizationNumber
            }.${OIDNode.patients}.${patientNumber}`;
            attributes.patientNumber = patientNumber;
          },
        },
      }
    );
  };
}
