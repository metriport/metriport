import type { Migration } from "..";

const patientTableName = "patient";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    const patients = (await queryInterface.select(null, patientTableName, {
      transaction,
    })) as any[]; //eslint-disable-line @typescript-eslint/no-explicit-any
    for (const patient of patients) {
      if (patient.data.address && !Array.isArray(patient.data.address)) {
        patient.data.address = [patient.data.address];
      }
      if (
        patient.data.contact &&
        !Array.isArray(patient.data.contact) &&
        (patient.data.contact.email || patient.data.contact.phone)
      ) {
        patient.data.contact = [patient.data.contact];
      }
      patient.data = JSON.stringify(patient.data);
    }
    if (patients.length > 0) {
      await queryInterface.bulkDelete(patientTableName, {}, { transaction });
      await queryInterface.bulkInsert(patientTableName, patients, { transaction });
    }
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    const patients = (await queryInterface.select(null, patientTableName, {
      transaction,
    })) as any[]; //eslint-disable-line @typescript-eslint/no-explicit-any
    for (const patient of patients) {
      if (
        patient.data.address &&
        Array.isArray(patient.data.address) &&
        patient.data.address.size > 0
      ) {
        patient.data.address = patient.data.address[0];
      }
      if (
        patient.data.contact &&
        Array.isArray(patient.data.contact) &&
        patient.data.contact.size > 0
      ) {
        patient.data.contact = patient.data.contact[0];
      }
      patient.data = JSON.stringify(patient.data);
    }
    if (patients.length > 0) {
      await queryInterface.bulkDelete(patientTableName, {}, { transaction });
      await queryInterface.bulkInsert(patientTableName, patients, { transaction });
    }
  });
};
