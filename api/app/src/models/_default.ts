import {
  InferAttributes,
  InferCreationAttributes,
  InitOptions,
  Model,
  Sequelize,
} from "sequelize";

export type ModelSetup = (sequelize: Sequelize) => void;

export const defaultModelOptions = <M extends Model>(
  sequelize: Sequelize
): InitOptions<M> => ({
  sequelize,
  freezeTableName: true,
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

export abstract class BaseModel<T extends Model<any, any>> extends Model<
  InferAttributes<T>,
  InferCreationAttributes<T>
> {
  declare createdAt?: Date;
  declare updatedAt?: Date;
}
