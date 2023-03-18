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
  version: CreationOptional<number>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseModel<T extends Model<any, any>>
  extends Model<InferAttributes<T>, InferCreationAttributes<T>>
  implements IBaseModel
{
  declare id: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  // TODO #410 use get/set to have this string on the app and number in the DB
  // TODO #410 consider renaming the column/prop to eTag so we don't have to convert
  // on the route/API layer
  // https://sequelize.org/docs/v6/core-concepts/getters-setters-virtuals/
  declare version: CreationOptional<number>;

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
    };
  }
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateVersionForUpdate<T extends Model<any, any>>(
  entity: BaseModel<T>,
  version: number | undefined
) {
  if (version != null && version !== entity.version) {
    const name = entity.constructor.name ?? "entity";
    throw new VersionMismatchError(`Version mismatch for ${name} ${entity.id}`);
  }
}
