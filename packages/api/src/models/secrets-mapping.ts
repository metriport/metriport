import { DataTypes, Sequelize } from "sequelize";
import { SecretsMapping, SecretsSources } from "../domain/secrets-mapping";
import { BaseModel, ModelSetup } from "./_default";

export class SecretsMappingModel extends BaseModel<SecretsMappingModel> implements SecretsMapping {
  static NAME = "secrets_mapping";
  declare externalId: string;
  declare cxId: string;
  declare secretArn: string;
  declare source: SecretsSources;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    SecretsMappingModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        secretArn: {
          type: DataTypes.STRING,
        },
        source: {
          type: DataTypes.STRING,
        },
        externalId: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: SecretsMappingModel.NAME,
      }
    );
  };
}
