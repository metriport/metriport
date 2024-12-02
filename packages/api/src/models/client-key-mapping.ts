import { DataTypes, Sequelize } from "sequelize";
import { ClientKeyMapping, ClientKeySources, ClientKeyData } from "../domain/client-key-mapping";
import { BaseModel, ModelSetup } from "./_default";

export class ClientKeyMappingModel
  extends BaseModel<ClientKeyMappingModel>
  implements ClientKeyMapping
{
  static NAME = "client_key_mapping";
  declare externalId: string;
  declare data: ClientKeyData;
  declare cxId: string;
  declare clientKey: string;
  declare clientSecret: string;
  declare source: ClientKeySources;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    ClientKeyMappingModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        clientKey: {
          type: DataTypes.STRING,
        },
        clientSecret: {
          type: DataTypes.STRING,
        },
        source: {
          type: DataTypes.STRING,
        },
        externalId: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: ClientKeyMappingModel.NAME,
      }
    );
  };
}
