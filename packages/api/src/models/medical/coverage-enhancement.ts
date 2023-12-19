import { DataTypes, Sequelize } from "sequelize";
import {
  CoverageEnhancement,
  CoverageEnhancementData,
} from "../../domain/medical/coverage-enhancement";
import { BaseModelNoId, ModelSetup } from "../_default";

export class CoverageEnhancementModel
  extends BaseModelNoId<CoverageEnhancementModel>
  implements CoverageEnhancement
{
  static NAME = "coverage-enhancement";
  declare ecId: string;
  declare patientId: string;
  declare cxId: string;
  declare data: CoverageEnhancementData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CoverageEnhancementModel.init(
      {
        ...BaseModelNoId.attributes(),
        ecId: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
        patientId: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.UUID,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModelNoId.modelOptions(sequelize),
        tableName: CoverageEnhancementModel.NAME,
      }
    );
  };
}
