import { CreationOptional, DataTypes, Sequelize } from "sequelize";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Config } from "../../shared/config";
import { OIDNode, OID_ID_START } from "../../shared/oid";
import { BaseModel, defaultModelOptions, IBaseModel, ModelSetup } from "../_default";
import { Address } from "./address";

export type FacilityData = {
  name: string;
  npi: string;
  tin?: string;
  active?: boolean;
  address: Address;
};

export interface Facility extends IBaseModel {
  cxId: string;
  data: FacilityData;
}

export class FacilityModel extends BaseModel<FacilityModel> implements Facility {
  static NAME = "facility";
  declare cxId: string;
  declare facilityNumber: CreationOptional<number>;
  declare data: FacilityData; // TODO #414 move to strong type

  static setup: ModelSetup = (sequelize: Sequelize) => {
    FacilityModel.init(
      {
        ...BaseModel.baseAttributes(),
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
        tableName: FacilityModel.NAME,
        hooks: {
          async beforeCreate(attributes) {
            const curMaxNumber = (await FacilityModel.max("facilityNumber", {
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
