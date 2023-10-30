import { DataTypes, Sequelize } from "sequelize";
import { Request, RequestData } from "../../domain/medical/request";
import { BaseModel, ModelSetup } from "../_default";

export class RequestModel extends BaseModel<RequestModel> implements Request {
  static NAME = "request";
  declare cxId: string;
  declare patientId: string;
  declare facilityIds: string[];
  declare data: RequestData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    RequestModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        facilityIds: {
          type: DataTypes.ARRAY(DataTypes.STRING),
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: RequestModel.NAME,
      }
    );
  };
}
