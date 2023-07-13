import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import { ModelSetup } from "../_default";

export const dataTypes = ["organization", "facility", "patient"] as const;
export type DataType = (typeof dataTypes)[number];

export interface CustomerSequence {
  id: string; // Customer ID
  dataType: DataType;
  sequence: number;
}

export class CustomerSequenceModel
  extends Model<
    InferAttributes<CustomerSequenceModel>,
    InferCreationAttributes<CustomerSequenceModel>
  >
  implements CustomerSequence
{
  static NAME = "customer_sequence";
  declare id: string;
  declare dataType: DataType;
  declare sequence: number;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CustomerSequenceModel.init(
      {
        id: { type: DataTypes.STRING, primaryKey: true },
        dataType: { type: DataTypes.STRING, primaryKey: true },
        sequence: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true },
      },
      {
        sequelize,
        tableName: CustomerSequenceModel.NAME,
        freezeTableName: true,
        timestamps: false,
        underscored: true,
      }
    );
  };
}
