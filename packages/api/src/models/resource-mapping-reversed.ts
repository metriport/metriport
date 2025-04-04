import { DataTypes, Sequelize } from "sequelize";
import {
  ResourceMappingReversed,
  ResourceMappingReversedSource,
} from "../domain/resource-mapping-reversed";
import { BaseModel, ModelSetup } from "./_default";

export class ResourceMappingReversedModel
  extends BaseModel<ResourceMappingReversedModel>
  implements ResourceMappingReversed
{
  static NAME = "resource_mapping_reversed";
  declare externalId: string;
  declare cxId: string;
  declare patientId: string;
  declare patientMappingExternalId: string;
  declare resourceId: string;
  declare source: ResourceMappingReversedSource;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    ResourceMappingReversedModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.UUID,
        },
        patientMappingExternalId: {
          type: DataTypes.STRING,
        },
        resourceId: {
          type: DataTypes.STRING,
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
        tableName: ResourceMappingReversedModel.NAME,
      }
    );
  };
}
