import { DataTypes } from "sequelize";
import type { Migration } from "..";

const facilityTableName = "facility";

const cwTypeColumn = "cw_type";
const typeColumn = "type";

const cwOboOidColumn = "cw_obo_oid";
const principalOidColumn = "principal_oid";

const INITIATOR_ONLY = "initiator_only";
const INITIATOR_AND_RESPONDER = "initiator_and_responder";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    // Add new columns
    await queryInterface.addColumn(
      facilityTableName,
      typeColumn,
      {
        type: DataTypes.ENUM(INITIATOR_AND_RESPONDER, INITIATOR_ONLY),
        defaultValue: INITIATOR_AND_RESPONDER,
        allowNull: false,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      principalOidColumn,
      {
        type: DataTypes.STRING,
        allowNull: true,
      },
      { transaction }
    );

    // Copy data from old columns to new columns
    await queryInterface.sequelize.query(
      `UPDATE ${facilityTableName} SET ${typeColumn} = ${cwTypeColumn}::text::enum_facility_type`,
      { transaction }
    );
    await queryInterface.sequelize.query(
      `UPDATE ${facilityTableName} SET ${principalOidColumn} = ${cwOboOidColumn}`,
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    // Remove the new columns
    await queryInterface.removeColumn(facilityTableName, typeColumn, {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, principalOidColumn, {
      transaction,
    });
  });
};
