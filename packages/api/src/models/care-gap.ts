import { DataTypes, Sequelize } from "sequelize";
import { CareGap, MeasureReport } from "@metriport/shared/src/domain/care-gap";
import { BaseModel, ModelSetup } from "./_default";

export class CareGapModel extends BaseModel<CareGapModel> implements CareGap {
  static NAME = "care_gap";
  declare cxId: string;
  declare jobId: string;
  declare patientId: string;
  declare measureName: string;
  declare measureReport: MeasureReport;
  declare supportingEvidence: Record<string, unknown>;
  declare lastRun: Date;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CareGapModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.STRING,
        },
        jobId: {
          type: DataTypes.STRING,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        measureName: {
          type: DataTypes.STRING,
        },
        measureReport: {
          type: DataTypes.JSONB,
        },
        supportingEvidence: {
          type: DataTypes.JSONB,
        },
        lastRun: {
          type: DataTypes.DATE,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CareGapModel.NAME,
      }
    );
  };
}
