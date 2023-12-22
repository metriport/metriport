import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  InitOptions,
  Model,
  Sequelize,
} from "sequelize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseIHEResultModel<T extends Model<any, any>> extends Model<
  InferAttributes<T>,
  InferCreationAttributes<T>
> {
  declare id: string;
  declare requestId: string;
  declare patientId: string | undefined;
  declare status: string;
  declare createdAt: CreationOptional<Date>;

  static attributes() {
    return {
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
    };
  }
  static modelOptions<M extends Model>(sequelize: Sequelize): InitOptions<M> {
    return {
      sequelize,
      freezeTableName: true,
      underscored: true,
      timestamps: false,
      createdAt: "created_at",
    };
  }
}
