import { DataTypes, Sequelize, Model, CreationOptional } from "sequelize";
import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { PatientDiscoveryResult } from "../domain/patient-discovery-result";
import { ModelSetup } from "../../../models/_default";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class PatientDiscoveryResultModel extends Model<any, any> implements PatientDiscoveryResult {
  static NAME = "patient_discovery_result";
  declare id: string;
  declare requestId: string;
  declare patientId: string;
  declare status: string;
  declare createdAt: CreationOptional<Date>;
  declare data: PatientDiscoveryResponse;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientDiscoveryResultModel.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
        requestId: {
          type: DataTypes.UUID,
          field: "request_id",
        },
        patientId: {
          type: DataTypes.UUID,
          field: "patient_id",
        },
        status: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
        createdAt: {
          type: DataTypes.DATE(6),
        },
      },
      {
        sequelize,
        freezeTableName: true,
        underscored: true,
        timestamps: false,
        createdAt: "created_at",
        tableName: PatientDiscoveryResultModel.NAME,
      }
    );
  };
}
