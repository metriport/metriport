import * as link from "./link";
import * as organization from "./organization";
import * as patient from "./patient";
import * as patientExternal from "./patient-external-data";

const cwCommands = {
  organization: {
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
    getLinkStatusCQ: patientExternal.getLinkStatusCQ,
    getLinkStatusCW: patientExternal.getLinkStatusCW,
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
