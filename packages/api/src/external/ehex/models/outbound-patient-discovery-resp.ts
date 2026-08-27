import { CreationOptional, DataTypes, Model, Sequelize } from "sequelize";
import { ModelSetup } from "../../../models/_default";
import { EhexOutboundPatientDiscoveryResp } from "./interfaces";

export class EhexOutboundPatientDiscoveryRespModel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extends Model<any, any>
  implements EhexOutboundPatientDiscoveryResp
{
  static NAME = "ehex_patient_discovery_result";
  declare id: string;
  declare requestId: string;
  declare patientId: string;
  declare status: string;
  declare createdAt: CreationOptional<Date>;
  declare data: EhexOutboundPatientDiscoveryResp["data"];

  static setup: ModelSetup = (sequelize: Sequelize) => {
    EhexOutboundPatientDiscoveryRespModel.init(
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
        tableName: EhexOutboundPatientDiscoveryRespModel.NAME,
      }
    );
  };
}
