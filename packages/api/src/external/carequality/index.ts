import * as organization from "./command/cq-organization/create-or-update-cq-organization";
import * as patient from "./patient";

const cqCommands = {
  organization: {
    createOrUpdate: organization.createOrUpdateCqOrganization,
  },
  patient: {
    discover: patient.discover,
    remove: patient.remove,
  },
};

export default cqCommands;
