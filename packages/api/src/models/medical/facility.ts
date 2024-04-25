import { OIDNode, OID_ID_START } from "@metriport/core/domain/oid";
import { DataTypes, Sequelize } from "sequelize";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Facility, FacilityData } from "../../domain/medical/facility";
import { BaseModel, ModelSetup } from "../../models/_default";
import { Config } from "../../shared/config";
import { executeOnDBTx } from "../transaction-wrapper";

export enum FacilityType {
  initiatorAndResponder = "initiator_and_responder",
  initiatorOnly = "initiator_only",
}

export class FacilityModel extends BaseModel<FacilityModel> implements Facility {
  static NAME = "facility";
  declare cxId: string;
  declare oid: string;
  declare facilityNumber: number;
  declare cqOboActive: boolean;
  declare cwOboActive: boolean;
  declare cqOboOid: string | null;
  declare cwOboOid: string | null;
  declare type: FacilityType;
  declare data: FacilityData; // TODO #414 move to strong type

  static setup: ModelSetup = (sequelize: Sequelize) => {
    FacilityModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        oid: {
          type: DataTypes.STRING,
          unique: true,
        },
        facilityNumber: {
          type: DataTypes.INTEGER,
        },
        data: {
          type: DataTypes.JSONB,
        },
        cqOboActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        cwOboActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        cqOboOid: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        cwOboOid: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        type: {
          type: DataTypes.ENUM(...Object.values(FacilityType)),
          defaultValue: FacilityType.initiatorAndResponder,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: FacilityModel.NAME,
        hooks: {
          async beforeCreate(attributes) {
            const org = await getOrganizationOrFail({ cxId: attributes.cxId });
            await executeOnDBTx(FacilityModel.prototype, async transaction => {
              const curMaxNumber = (await FacilityModel.max("facilityNumber", {
                where: {
                  cxId: attributes.cxId,
                },
                transaction,
              })) as number;
              const facNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
              attributes.oid = `${Config.getSystemRootOID()}.${OIDNode.organizations}.${
                org.organizationNumber
              }.${OIDNode.locations}.${facNumber}`;
              attributes.facilityNumber = facNumber;
            });
          },
        },
      }
    );
  };
}
