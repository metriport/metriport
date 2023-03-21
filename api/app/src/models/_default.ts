import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  InitOptions,
  Model,
  Sequelize,
} from "sequelize";
import VersionMismatchError from "../errors/version-mismatch";
import { Util } from "../shared/util";

export type ModelSetup = (sequelize: Sequelize) => void;

export const defaultModelOptions = <M extends Model>(sequelize: Sequelize): InitOptions<M> => ({
  sequelize,
  freezeTableName: true,
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  version: true, // requires a `version` column; override it to false if you don't want versioning
});

export interface IBaseModel {
  id: string;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  eTag: CreationOptional<string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseModel<T extends Model<any, any>>
  extends Model<InferAttributes<T>, InferCreationAttributes<T>>
  implements IBaseModel
{
  declare id: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  private declare version: CreationOptional<number>;
  declare eTag: CreationOptional<string>;

  static baseAttributes() {
    return {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      createdAt: {
        type: DataTypes.DATE(6),
      },
      updatedAt: {
        type: DataTypes.DATE(6),
      },
      // Full definition because this determines in-memory behavior to Sequelize
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      eTag: {
        type: DataTypes.VIRTUAL,
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        get<T extends Model<any, any>>(this: BaseModel<T>): string {
          return Util.md5(this.id + "_" + this.version);
        },
      },
    };
  }
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateVersionForUpdate<T extends Model<any, any>>(
  entity: BaseModel<T>,
  eTag: string | undefined
) {
  if (eTag != null && eTag !== entity.eTag) {
    const name = entity.constructor.name ?? "entity";
    throw new VersionMismatchError(`eTag mismatch for ${name} ${entity.id}`);
  }
}
