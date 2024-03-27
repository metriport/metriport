import { Sequelize, DataTypes } from "sequelize";
import { OutboundDocumentRetrievalResp as IHEOutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { OutboundDocumentRetrievalResp } from "../outbound-document-retrieval-resp";
import { ModelSetup } from "../../../models/_default";
import { BaseOutboundRespModel } from "../../../models/medical/outbound-resp";

export class OutboundDocumentRetrievalRespModel
  extends BaseOutboundRespModel<OutboundDocumentRetrievalRespModel>
  implements OutboundDocumentRetrievalResp
{
  static NAME = "document_retrieval_result";
  declare data: IHEOutboundDocumentRetrievalResp;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    OutboundDocumentRetrievalRespModel.init(
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
        tableName: OutboundDocumentRetrievalRespModel.NAME,
      }
    );
  };
}
