import { OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { DataTypes, Sequelize } from "sequelize";
import { ModelSetup } from "../../../models/_default";
import { BaseOutboundRespModel } from "../../../models/medical/outbound-resp";
import { EhexOutboundDocumentQueryResp } from "./interfaces";

export class EhexOutboundDocumentQueryRespModel
  extends BaseOutboundRespModel<EhexOutboundDocumentQueryRespModel>
  implements EhexOutboundDocumentQueryResp
{
  static NAME = "ehex_document_query_result";
  declare data: OutboundDocumentQueryResp;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    EhexOutboundDocumentQueryRespModel.init(
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
        tableName: EhexOutboundDocumentQueryRespModel.NAME,
      }
    );
  };
}
