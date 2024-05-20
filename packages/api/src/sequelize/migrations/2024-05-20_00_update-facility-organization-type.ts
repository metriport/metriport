import { DataTypes } from "sequelize";
import type { Migration } from "..";

const facilityTableName = "facility";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      facilityTableName,
      "cq_type",
      {
        type: DataTypes.ENUM("initiator_and_responder", "initiator_only"),
        defaultValue: "initiator_and_responder",
      },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cw_type",
      {
        type: DataTypes.ENUM("initiator_and_responder", "initiator_only"),
        defaultValue: "initiator_and_responder",
      },
      { transaction }
    );
    await queryInterface.renameColumn(facilityTableName, "cw_obo_active", "cw_active", {
      transaction,
    });
    await queryInterface.renameColumn(facilityTableName, "cq_obo_active", "cq_active", {
      transaction,
    });

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

      if (facility.type === "initiator_and_responder") {
        update["cq_type"] = facility.type;
        update["cw_type"] = facility.type;
      }

      if (facility.type === "initiator_only") {
        if (facility.cq_obo_active) {
          update["cq_type"] = "initiator_only";
        }

        if (facility.cw_obo_active) {
          update["cw_type"] = "initiator_only";
        }
      }

      await queryInterface.bulkUpdate(
        facilityTableName,
        update,
        {
          id: facility.id,
        },
        { transaction }
      );
    }

    await queryInterface.removeColumn(facilityTableName, "type", {
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(facilityTableName, "cq_type", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cw_type", {
      transaction,
    });
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
        type: DataTypes.ENUM("initiator_and_responder", "initiator_only"),
        defaultValue: "initiator_and_responder",
      },
      { transaction }
    );
  });
};
