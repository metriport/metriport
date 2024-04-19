import { DataTypes } from "sequelize";
import type { Migration } from "..";

const facilityTableName = "facility";
const organizationTableName = "organization";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      facilityTableName,
      "oid",
      { type: DataTypes.STRING, unique: true },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "facility_number",
      { type: DataTypes.INTEGER },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cq_obo_active",
      { type: DataTypes.BOOLEAN, defaultValue: false },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cw_obo_active",
      { type: DataTypes.BOOLEAN, defaultValue: false },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cq_obo_oid",
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cw_obo_oid",
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "type",
      {
        type: DataTypes.ENUM("initiator_and_responder", "initiator_only"),
        defaultValue: "initiator_and_responder",
      },
      { transaction }
    );
    await queryInterface.addColumn(
      organizationTableName,
      "type",
      {
        type: DataTypes.ENUM("healthcare_provider", "healthcare_it_vendor"),
        defaultValue: "healthcare_provider",
      },
      { transaction }
    );

    const [orgResults] = await queryInterface.sequelize.query(
      `select * from ${organizationTableName}`,
      {
        transaction,
      }
    );
    if (orgResults && orgResults.length) {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const org of orgResults as any[]) {
        const [facilityResults] = await queryInterface.sequelize.query(
          `select * from ${facilityTableName} where cx_id = '${org["cx_id"]}'`,
          {
            transaction,
          }
        );
        if (facilityResults && facilityResults.length) {
          let facilityNumber = 100;
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const facility of facilityResults as any[]) {
            const facilityOid = `2.16.840.1.113883.3.9621.5.${org["organization_number"]}.4.${facilityNumber}`;
            await queryInterface.sequelize.query(
              `update ${facilityTableName} set facility_number = '${facilityNumber}', oid = '${facilityOid}' where id = '${facility.id}'`,
              {
                transaction,
              }
            );
            facilityNumber++;
          }
        }
      }
    }
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(organizationTableName, "type", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "type", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cw_obo_oid", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cq_obo_oid", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cw_obo_active", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cq_obo_active", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "facility_number", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "oid", {
      transaction,
    });
  });
};
