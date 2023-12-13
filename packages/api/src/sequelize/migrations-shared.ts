import {
  CreationAttributes,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  literal,
  Model,
  ModelAttributes,
  QueryInterface,
  QueryInterfaceCreateTableOptions,
  Transaction,
} from "sequelize";
import { DeepNonNullable } from "ts-essentials";

export const updateUpdatedAtFnName = "update_trigger_fn";

class BaseModel extends Model<InferAttributes<BaseModel>, InferCreationAttributes<BaseModel>> {
  declare createdAt: Date;
  declare updatedAt: Date;
}

// default columns, don't change them here; if you need something different do it on the migration file
export const defaultColumnsDef = ({
  version,
}: {
  version: boolean | undefined;
}): ModelAttributes<BaseModel, CreationAttributes<BaseModel>> => ({
  createdAt: {
    field: "created_at",
    type: DataTypes.DATE(6),
    allowNull: false,
    defaultValue: literal("CURRENT_TIMESTAMP(6)"), // https://github.com/sequelize/sequelize/issues/4896
  },
  updatedAt: {
    field: "updated_at",
    type: DataTypes.DATE(6),
    allowNull: false,
    defaultValue: literal("CURRENT_TIMESTAMP(6)"), // https://github.com/sequelize/sequelize/issues/4896
  },
  ...(version
    ? {
        version: {
          allowNull: false,
          type: DataTypes.INTEGER,
          defaultValue: 0,
        },
      }
    : undefined),
});

export const addUpdatedAtTrigger = (
  queryInterface: QueryInterface,
  transaction: Transaction,
  tableName: string
) =>
  queryInterface.createTrigger(
    tableName,
    `trg_update_${tableName}`,
    "before",
    //eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore - https://github.com/sequelize/sequelize/issues/11420
    { before: "update" },
    updateUpdatedAtFnName,
    [],
    ["FOR EACH ROW"],
    { transaction }
  );

export type CreateTableOptions = Omit<QueryInterfaceCreateTableOptions, "transaction"> &
  DeepNonNullable<Required<Pick<QueryInterfaceCreateTableOptions, "transaction">>> & {
    addVersion?: boolean;
  };

export const createTable = async (
  queryInterface: QueryInterface,
  tableName: string,
  tableDefinitions: ModelAttributes,
  options: CreateTableOptions
) => {
  await queryInterface.createTable(
    tableName,
    {
      ...tableDefinitions,
      ...defaultColumnsDef({ version: options.addVersion }),
    },
    options
  );
  await addUpdatedAtTrigger(queryInterface, options.transaction, tableName);
};

export const resultsColumns = {
  id: {
    type: DataTypes.STRING,
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
    field: "status",
  },
  data: {
    type: DataTypes.JSONB,
  },
  createdAt: {
    field: "created_at",
    type: DataTypes.DATE(6),
    allowNull: false,
    defaultValue: literal("CURRENT_TIMESTAMP(6)"),
  },
};
