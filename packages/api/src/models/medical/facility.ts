import { OID_ID_START } from "@metriport/core/domain/oid";
import { DataTypes, Sequelize } from "sequelize";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import {
  Facility,
  FacilityData,
  FacilityType,
  makeFacilityOid,
} from "../../domain/medical/facility";
import { BaseModel, ModelSetup } from "../../models/_default";
import { executeOnDBTx } from "../transaction-wrapper";

export class FacilityModel extends BaseModel<FacilityModel> implements Facility {
  static NAME = "facility";
  declare cxId: string;
  declare oid: string;
  declare facilityNumber: number;
  declare cqActive: boolean;
  declare cwActive: boolean;
  declare cqOboOid: string | null;
  declare cwOboOid: string | null;
  declare cwType: FacilityType;
  declare cqType: FacilityType;
  declare data: FacilityData;

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
        cqActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        cwActive: {
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
        cwType: {
          type: DataTypes.ENUM(...Object.values(FacilityType)),
          defaultValue: FacilityType.initiatorAndResponder,
        },
        cqType: {
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
              const facilityNumber = curMaxNumber ? curMaxNumber + 1 : OID_ID_START;
              attributes.oid = makeFacilityOid(org.organizationNumber, facilityNumber);
              attributes.facilityNumber = facilityNumber;
            });
          },
        },
      }
    );
  };
}
