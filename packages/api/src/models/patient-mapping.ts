import { DataTypes, Sequelize } from "sequelize";
import { PatientMapping } from "../domain/patient-mapping";
import { BaseModelNoId, ModelSetup } from "./_default";

export class PatientMappingModel
  extends BaseModelNoId<PatientMappingModel>
  implements PatientMapping
{
  static NAME = "cx_mapping";
  declare externalId: string;
  declare patientId: string;
  declare source: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientMappingModel.init(
      {
        ...BaseModelNoId.attributes(),
        patientId: {
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
        ...BaseModelNoId.modelOptions(sequelize),
        tableName: PatientMappingModel.NAME,
      }
    );
  };
}
