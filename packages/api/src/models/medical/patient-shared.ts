import { DataTypes, Sequelize } from "sequelize";
import { BaseModel } from "../_default";

export const patientTableName = "patient";

export function initParams() {
  return {
    cxId: {
      type: DataTypes.UUID,
    },
    facilityIds: {
      type: DataTypes.ARRAY(DataTypes.STRING),
    },
    externalId: {
      type: DataTypes.STRING,
    },
    hieOptOut: {
      type: DataTypes.BOOLEAN,
    },
    data: {
      type: DataTypes.JSONB,
    },
  };
}

export function initModel(sequelize: Sequelize) {
  return {
    attributes: {
      ...BaseModel.attributes(),
      ...initParams(),
    },
    options: {
      ...BaseModel.modelOptions(sequelize),
      tableName: patientTableName,
    },
  };
}
