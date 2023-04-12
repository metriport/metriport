import { CreationOptional, DataTypes, Sequelize } from "sequelize";
import { BaseDomain, BaseDomainCreate } from "../../domain/base-domain";
import { BaseModel, ModelSetup } from "../_default";
import { Address } from "./address";

export type FacilityData = {
  name: string;
  npi: string;
  tin?: string;
  active?: boolean;
  address: Address;
};

export interface FacilityCreate extends BaseDomainCreate {
  cxId: string;
  facilityNumber: number;
  data: FacilityData;
}
export interface Facility extends BaseDomain, FacilityCreate {}

export class FacilityModel extends BaseModel<FacilityModel> implements Facility {
  static NAME = "facility";
  declare cxId: string;
  declare facilityNumber: CreationOptional<number>;
  declare data: FacilityData; // TODO #414 move to strong type

  static setup: ModelSetup = (sequelize: Sequelize) => {
    FacilityModel.init(
      {
        ...BaseModel.attributes(),
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
        ...BaseModel.modelOptions(sequelize),
        tableName: FacilityModel.NAME,
      }
    );
  };
}
