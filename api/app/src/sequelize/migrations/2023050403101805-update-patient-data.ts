import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { PatientModel } from "../../models/medical/patient";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    const patients = (await queryInterface.select(null, PatientModel.NAME, {
      transaction,
    })) as any[]; //eslint-disable-line @typescript-eslint/no-explicit-any
    const newPatients: any[] = []; //eslint-disable-line @typescript-eslint/no-explicit-any
    for (const patient of patients) {
      let newPatientData = { ...patient.data };
      if (newPatientData.address && !Array.isArray(newPatientData.address)) {
        newPatientData = { ...newPatientData, address: [newPatientData.address] };
      }
      if (
        newPatientData.contact &&
        !Array.isArray(newPatientData.contact) &&
        (newPatientData.contact.email || newPatientData.contact.phone)
      ) {
        newPatientData = { ...newPatientData, contact: [newPatientData.contact] };
      }
      newPatients.push({ ...patient, data: { ...newPatientData } });
    }
    await queryInterface.bulkDelete(PatientModel.NAME, {}, { transaction });
    console.log(newPatients[0].data.address);
    await queryInterface.bulkInsert(
      PatientModel.NAME,
      newPatients,
      { transaction },
      { data: { type: DataTypes.JSONB } }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    const patients = (await queryInterface.select(null, PatientModel.NAME, {
      transaction,
    })) as any[]; //eslint-disable-line @typescript-eslint/no-explicit-any
    const newPatients: any[] = []; //eslint-disable-line @typescript-eslint/no-explicit-any
    for (const patient of patients) {
      let newPatientData = { ...patient.data };
      if (
        newPatientData.address &&
        Array.isArray(newPatientData.address) &&
        newPatientData.address.size > 0
      ) {
        newPatientData = { ...newPatientData, address: newPatientData.address[0] };
      }
      if (
        newPatientData.contact &&
        Array.isArray(newPatientData.contact) &&
        newPatientData.contact.size > 0
      ) {
        newPatientData = { ...newPatientData, contact: newPatientData.contact[0] };
      }
      newPatients.push({ ...patient, data: { ...newPatientData } });
    }
    await queryInterface.bulkDelete(PatientModel.NAME, {}, { transaction });
    await queryInterface.bulkInsert(
      PatientModel.NAME,
      newPatients,
      { transaction },
      { data: { type: DataTypes.JSONB } }
    );
  });
};
