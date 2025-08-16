import * as link from "./link";
import * as organization from "./command/create-or-update-cw-organization";
import * as patient from "./patient";

const cwCommands = {
  organization: {
    createOrUpdate: organization.createOrUpdateCWOrganization,
  },
  patient: {
    create: patient.create,
    get: patient.get,
    update: patient.update,
    remove: patient.remove,
    getLinkStatusCQ: patient.getLinkStatusCQ,
    getLinkStatusCW: patient.getLinkStatusCW,
  },
  link: {
    create: link.create,
    get: link.get,
    reset: link.reset,
    findAllPotentialLinks: link.findAllPotentialLinks,
    findCurrentLink: link.findCurrentLink,
  },
};

export default cwCommands;
