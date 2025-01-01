import { DataTypes } from "sequelize";
import type { Migration } from "..";

const facilityTableName = "facility";
const INITIATOR_ONLY = "initiator_only";
const INITIATOR_AND_RESPONDER = "initiator_and_responder";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      facilityTableName,
      "cq_type",
      {
        type: DataTypes.ENUM(INITIATOR_AND_RESPONDER, INITIATOR_ONLY),
        defaultValue: INITIATOR_AND_RESPONDER,
        allowNull: false,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cw_type",
      {
        type: DataTypes.ENUM(INITIATOR_AND_RESPONDER, INITIATOR_ONLY),
        defaultValue: INITIATOR_AND_RESPONDER,
        allowNull: false,
      },
      { transaction }
    );

    const [facilityResults] = await queryInterface.sequelize.query(
      `select * from ${facilityTableName}`,
      {
        transaction,
      }
    );

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const facility of facilityResults as any[]) {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: any = {};

      if (facility.type === INITIATOR_AND_RESPONDER) {
        update["cq_type"] = facility.type;
        update["cw_type"] = facility.type;
      }

      if (facility.type === INITIATOR_ONLY) {
        if (facility.cq_obo_oid) {
          update["cq_type"] = INITIATOR_ONLY;
        } else {
          update["cq_type"] = INITIATOR_AND_RESPONDER;
        }

        if (facility.cw_obo_oid) {
          update["cw_type"] = INITIATOR_ONLY;
        } else {
          update["cw_type"] = INITIATOR_AND_RESPONDER;
        }
      }

      await queryInterface.sequelize.query(
        `update ${facilityTableName} set cw_type = '${update.cw_type}', cq_type = '${update.cq_type}' where id = '${facility.id}'`,
        {
          transaction,
        }
      );
    }

    await queryInterface.renameColumn(facilityTableName, "cw_obo_active", "cw_active", {
      transaction,
    });
    await queryInterface.renameColumn(facilityTableName, "cq_obo_active", "cq_active", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "type", {
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameColumn(facilityTableName, "cw_active", "cw_obo_active", {
      transaction,
    });
    await queryInterface.renameColumn(facilityTableName, "cq_active", "cq_obo_active", {
      transaction,
    });
    await queryInterface.addColumn(
      facilityTableName,
      "type",
      {
        type: DataTypes.ENUM(INITIATOR_AND_RESPONDER, INITIATOR_ONLY),
        defaultValue: INITIATOR_AND_RESPONDER,
        allowNull: false,
      },
      { transaction }
    );

    const [facilityResults] = await queryInterface.sequelize.query(
      `select * from ${facilityTableName}`,
      {
        transaction,
      }
    );

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const facility of facilityResults as any[]) {
      const cwType = facility.cw_type;
      const cqType = facility.cq_type;
      const cwOboOid = facility.cw_obo_oid;
      const cqOboOid = facility.cq_obo_oid;

      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      let type = INITIATOR_AND_RESPONDER;

      if ((cwType === INITIATOR_ONLY && cwOboOid) || (cqType === INITIATOR_ONLY && cqOboOid)) {
        type = INITIATOR_ONLY;
      }

      await queryInterface.sequelize.query(
        `update ${facilityTableName} set type = '${type}' where id = '${facility.id}'`,
        {
          transaction,
        }
      );
    }

    await queryInterface.removeColumn(facilityTableName, "cq_type", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cw_type", {
      transaction,
    });
  });
};
