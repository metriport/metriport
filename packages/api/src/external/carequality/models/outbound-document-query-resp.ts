import { Sequelize, DataTypes } from "sequelize";
import { OutboundDocumentQueryResp as IHEOutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { OutboundDocumentQueryResp } from "../outbound-document-query-resp";
import { ModelSetup } from "../../../models/_default";
import { BaseOutboundRespModel } from "../../../models/medical/outbound-resp";

export class OutboundDocumentQueryRespModel
  extends BaseOutboundRespModel<OutboundDocumentQueryRespModel>
  implements OutboundDocumentQueryResp
{
  static NAME = "document_query_result";
  declare data: IHEOutboundDocumentQueryResp;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    OutboundDocumentQueryRespModel.init(
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
        tableName: OutboundDocumentQueryRespModel.NAME,
      }
    );
  };
}
