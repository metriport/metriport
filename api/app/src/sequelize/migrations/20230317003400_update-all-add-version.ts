import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { ConnectedUser } from "../../models/connected-user";
import { Facility } from "../../models/medical/facility";
import { MAPIAccess } from "../../models/medical/mapi-access";
import { Organization } from "../../models/medical/organization";
import { PatientModel } from "../../models/medical/patient";
import { Settings } from "../../models/settings";
import { WebhookRequest } from "../../models/webhook-request";

const columnName = "version";
const columnDef = { allowNull: false, type: DataTypes.INTEGER, defaultValue: 0 };

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    return Promise.all([
      queryInterface.addColumn(ConnectedUser.NAME, columnName, columnDef, { transaction }),
      queryInterface.addColumn(Settings.NAME, columnName, columnDef, { transaction }),
      queryInterface.addColumn(WebhookRequest.NAME, columnName, columnDef, { transaction }),
      queryInterface.addColumn(MAPIAccess.NAME, columnName, columnDef, { transaction }),
      queryInterface.addColumn(Organization.NAME, columnName, columnDef, { transaction }),
      queryInterface.addColumn(Facility.NAME, columnName, columnDef, { transaction }),
      queryInterface.addColumn(PatientModel.NAME, columnName, columnDef, { transaction }),
    ]);
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    return Promise.all([
      queryInterface.removeColumn(PatientModel.NAME, columnName, { transaction }),
      queryInterface.removeColumn(Facility.NAME, columnName, { transaction }),
      queryInterface.removeColumn(Organization.NAME, columnName, { transaction }),
      queryInterface.removeColumn(MAPIAccess.NAME, columnName, { transaction }),
      queryInterface.removeColumn(WebhookRequest.NAME, columnName, { transaction }),
      queryInterface.removeColumn(Settings.NAME, columnName, { transaction }),
      queryInterface.removeColumn(ConnectedUser.NAME, columnName, { transaction }),
    ]);
  });
};
