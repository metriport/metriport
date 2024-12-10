import * as patient from "./patient";
import * as organization from "./command/cq-organization/create-or-update-cq-organization";

const cqCommands = {
  organization: {
    createOrUpdate: organization.createOrUpdateCQOrganization,
  },
  patient: {
    discover: patient.discover,
    remove: patient.remove,
  },
};

export default cqCommands;
