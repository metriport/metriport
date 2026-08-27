import { OutboundDocumentRetrievalResp as IHEOutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { DataTypes, Sequelize } from "sequelize";
import { ModelSetup } from "../../../models/_default";
import { BaseOutboundRespModel } from "../../../models/medical/outbound-resp";
import { EhexOutboundDocumentRetrievalResp } from "./interfaces";

export class EhexOutboundDocumentRetrievalRespModel
  extends BaseOutboundRespModel<EhexOutboundDocumentRetrievalRespModel>
  implements EhexOutboundDocumentRetrievalResp
{
  static NAME = "ehex_document_retrieval_result";
  declare data: IHEOutboundDocumentRetrievalResp;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    EhexOutboundDocumentRetrievalRespModel.init(
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
        tableName: EhexOutboundDocumentRetrievalRespModel.NAME,
      }
    );
  };
}
