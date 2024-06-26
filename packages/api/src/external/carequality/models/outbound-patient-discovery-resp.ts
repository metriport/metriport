import { DataTypes, Sequelize, Model, CreationOptional } from "sequelize";
import { OutboundPatientDiscoveryResp as OutboundPatientDiscoveryRespCore } from "@metriport/ihe-gateway-sdk";
import { OutboundPatientDiscoveryResp } from "../outbound-patient-discovery-resp";
import { ModelSetup } from "../../../models/_default";

export class OutboundPatientDiscoveryRespModel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extends Model<any, any>
  implements OutboundPatientDiscoveryResp
{
  static NAME = "patient_discovery_result";
  declare id: string;
  declare requestId: string;
  declare patientId: string;
  declare status: string;
  declare createdAt: CreationOptional<Date>;
  declare data: OutboundPatientDiscoveryRespCore;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    OutboundPatientDiscoveryRespModel.init(
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
        tableName: OutboundPatientDiscoveryRespModel.NAME,
      }
    );
  };
}
