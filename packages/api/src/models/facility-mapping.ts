import { DataTypes, Sequelize } from "sequelize";
import { FacilityMapping, FacilityMappingSource } from "../domain/facility-mapping";
import { BaseModel, ModelSetup } from "./_default";

export class FacilityMappingModel
  extends BaseModel<FacilityMappingModel>
  implements FacilityMapping
{
  static NAME = "facility_mapping";
  declare externalId: string;
  declare cxId: string;
  declare facilityId: string;
  declare source: FacilityMappingSource;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    FacilityMappingModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        facilityId: {
          type: DataTypes.UUID,
        },
        source: {
          type: DataTypes.STRING,
        },
        externalId: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: FacilityMappingModel.NAME,
      }
    );
  };
}
