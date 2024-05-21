import * as link from "./link";
import * as organization from "./organization";
import * as patient from "./patient";

const cwCommands = {
  organization: {
    get: organization.get,
    create: organization.create,
    update: organization.update,
    initCQOrgIncludeList: organization.initCQOrgIncludeList,
    organizationToCommonwell: organization.organizationToCommonwell,
  },
  patient: {
    create: patient.create,
    update: patient.update,
    remove: patient.remove,
    getCWData: patient.getCWData,
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
