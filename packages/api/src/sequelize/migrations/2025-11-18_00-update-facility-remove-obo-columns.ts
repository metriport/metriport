import { DataTypes } from "sequelize";
import type { Migration } from "..";

const facilityTableName = "facility";

const cwTypeColumn = "cw_type";
const typeColumn = "type";

const cwOboOidColumn = "cw_obo_oid";
const principalOidColumn = "principal_oid";

const cqTypeColumn = "cq_type";
const cqOboOidColumn = "cq_obo_oid";

const INITIATOR_ONLY = "initiator_only";
const INITIATOR_AND_RESPONDER = "initiator_and_responder";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(facilityTableName, cwTypeColumn, {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, cwOboOidColumn, {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, cqTypeColumn, {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, cqOboOidColumn, {
      transaction,
    });

    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS enum_facility_cw_type`, {
      transaction,
    });
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS enum_facility_cq_type`, {
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(
      `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_facility_cw_type'
        ) THEN
          CREATE TYPE enum_facility_cw_type AS ENUM ('${INITIATOR_AND_RESPONDER}', '${INITIATOR_ONLY}');
        END IF;
      END$$;
      `,
      { transaction }
    );

    await queryInterface.sequelize.query(
      `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_facility_cq_type'
        ) THEN
          CREATE TYPE enum_facility_cq_type AS ENUM ('${INITIATOR_AND_RESPONDER}', '${INITIATOR_ONLY}');
        END IF;
      END$$;
      `,
      { transaction }
    );

    await queryInterface.addColumn(
      facilityTableName,
      cwTypeColumn,
      {
        type: DataTypes.ENUM(INITIATOR_AND_RESPONDER, INITIATOR_ONLY),
        defaultValue: INITIATOR_AND_RESPONDER,
        allowNull: false,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      cwOboOidColumn,
      {
        type: DataTypes.STRING,
        allowNull: true,
      },
      { transaction }
    );

    await queryInterface.addColumn(
      facilityTableName,
      cqTypeColumn,
      {
        type: DataTypes.ENUM(INITIATOR_AND_RESPONDER, INITIATOR_ONLY),
        defaultValue: INITIATOR_AND_RESPONDER,
        allowNull: false,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      cqOboOidColumn,
      {
        type: DataTypes.STRING,
        allowNull: true,
      },
      { transaction }
    );

    await queryInterface.sequelize.query(
      `UPDATE ${facilityTableName} SET ${cwTypeColumn} = ${typeColumn}::text::enum_facility_cw_type`,
      { transaction }
    );
    await queryInterface.sequelize.query(
      `UPDATE ${facilityTableName} SET ${cwOboOidColumn} = ${principalOidColumn}`,
      { transaction }
    );
    await queryInterface.sequelize.query(
      `UPDATE ${facilityTableName} SET ${cqTypeColumn} = ${typeColumn}::text::enum_facility_cq_type`,
      { transaction }
    );
    await queryInterface.sequelize.query(
      `UPDATE ${facilityTableName} SET ${cqOboOidColumn} = ${principalOidColumn}`,
      { transaction }
    );
  });
};
