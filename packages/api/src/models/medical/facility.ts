import { DataTypes, Sequelize } from "sequelize";
import { Facility, FacilityData } from "../../domain/medical/facility";
import { BaseModel, ModelSetup } from "../../models/_default";

export class FacilityModel extends BaseModel<FacilityModel> implements Facility {
  static NAME = "facility";
  declare cxId: string;
  declare data: FacilityData; // TODO #414 move to strong type

  static setup: ModelSetup = (sequelize: Sequelize) => {
    FacilityModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
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
