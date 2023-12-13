import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  InitOptions,
  Model,
  Sequelize,
} from "sequelize";
import { BaseDomain } from "../domain/base-domain";
import VersionMismatchError from "../errors/version-mismatch";
import { Util } from "../shared/util";

export type ModelSetup = (sequelize: Sequelize) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseModel<T extends Model<any, any>>
  extends Model<InferAttributes<T>, InferCreationAttributes<T>>
  implements BaseDomain
{
  declare id: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  private declare version: CreationOptional<number>;
  declare eTag: CreationOptional<string>;

  static attributes() {
    return {
      id: {
        type: DataTypes.UUID,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get<T extends Model<any, any>>(this: BaseModel<T>): string {
          return Util.md5(this.id + "_" + this.version);
        },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseIHEResultModel<T extends Model<any, any>> extends Model<
  InferAttributes<T>,
  InferCreationAttributes<T>
> {
  declare id: string;
  declare requestId: string;
  declare patientId: string;
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
