import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  InitOptions,
  Model,
  Sequelize,
} from "sequelize";
import { BaseDomain, BaseDomainNoId } from "@metriport/core/domain/base-domain";
import VersionMismatchError from "../errors/version-mismatch";
import { Util } from "../shared/util";

export type ModelSetup = (sequelize: Sequelize) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseModelNoId<T extends Model<any, any>>
  extends Model<InferAttributes<T>, InferCreationAttributes<T>>
  implements BaseDomainNoId
{
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static attributes() {
    return {
      createdAt: {
        type: DataTypes.DATE(6),
      },
      updatedAt: {
        type: DataTypes.DATE(6),
      },
    };
  }
  static modelOptions<M extends Model>(sequelize: Sequelize): InitOptions<M> {
    return {
      sequelize,
      freezeTableName: true,
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseModel<T extends Model<any, any>>
  extends BaseModelNoId<T>
  implements BaseDomain
{
  declare id: string;
  private declare version: CreationOptional<number>;
  declare eTag: CreationOptional<string>;

  static override attributes() {
    return {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      ...BaseModelNoId.attributes(),
      // Full definition because this determines in-memory behavior to Sequelize
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      eTag: {
        type: DataTypes.VIRTUAL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get<T extends Model<any, any>>(this: BaseModel<T>): string {
          return Util.md5(this.id + "_" + this.version);
        },
      },
    };
  }
  static override modelOptions<M extends Model>(sequelize: Sequelize): InitOptions<M> {
    return {
      ...BaseModelNoId.modelOptions(sequelize),
      version: true, // requires a `version` column; override it to false if you don't want versioning
    };
  }
}

export function validateVersionForUpdate(
  entity: Pick<BaseDomain, "id" | "eTag">,
  eTag: string | undefined
) {
  if (eTag != null && eTag !== entity.eTag) {
    throw new VersionMismatchError(`eTag mismatch - reload the data and try again`);
  }
}
