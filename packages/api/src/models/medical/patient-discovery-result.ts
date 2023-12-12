import { DataTypes, Sequelize } from "sequelize";
import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { PatientDiscoveryResult } from "../../domain/medical/patient-discovery-result";
import { BaseModel, ModelSetup } from "../_default";

export class PatientDiscoveryResultModel
  extends BaseModel<PatientDiscoveryResultModel>
  implements PatientDiscoveryResult
{
  static NAME = "patient_discovery_result";
  declare requestId: string;
  declare patientId: string;
  declare status: string;
  declare data: PatientDiscoveryResponse;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientDiscoveryResultModel.init(
      {
        ...BaseModel.attributes(),
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
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientDiscoveryResultModel.NAME,
      }
    );
  };
}
