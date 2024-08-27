import { DataTypes, Sequelize } from "sequelize";
import { JwtToken } from "../domain/jwt-token";
import { BaseModel, ModelSetup } from "./_default";

export class JwtTokenModel extends BaseModel<JwtTokenModel> implements JwtToken {
  static NAME = "jwt_token";
  declare token: string;
  declare exp: Date;
  declare source: string;
  declare data: object;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    JwtTokenModel.init(
      {
        ...BaseModel.attributes(),
        token: {
          type: DataTypes.STRING,
        },
        exp: {
          type: DataTypes.DATE,
        },
        source: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: JwtTokenModel.NAME,
      }
    );
  };
}
