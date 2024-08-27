import { DataTypes, Sequelize } from "sequelize";
import { JwtToken } from "../domain/jwt-token";
import { BaseModelNoId, ModelSetup } from "./_default";

export class JwtTokenModel extends BaseModelNoId<JwtTokenModel> implements JwtToken {
  static NAME = "cx_mapping";
  declare token: string;
  declare exp: number;
  declare source: string;
  declare data: object;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    JwtTokenModel.init(
      {
        ...BaseModelNoId.attributes(),
        token: {
          type: DataTypes.UUID,
        },
        exp: {
          type: DataTypes.NUMBER,
        },
        source: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModelNoId.modelOptions(sequelize),
        tableName: JwtTokenModel.NAME,
      }
    );
  };
}
