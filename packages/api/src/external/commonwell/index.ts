// TODO ENG-513 update it
// TODO ENG-513 update it
// TODO ENG-513 update it
// TODO ENG-513 update it
// TODO ENG-513 update it
// TODO ENG-513 update it
// TODO ENG-513 update it
// TODO ENG-513 update it
import * as organization from "../commonwell-v1/command/create-or-update-cw-organization";
import * as link from "../commonwell-v1/link";
import * as patientV2 from "../commonwell-v1/patient";
import * as patient from "./patient/patient";

const cwCommands = {
  organization: {
    createOrUpdate: organization.createOrUpdateCWOrganization,
  },
  patient: {
    create: patient.create,
    get: patientV2.get,
    update: patient.update,
    remove: patientV2.remove,
    getLinkStatusCQ: patientV2.getLinkStatusCQ,
    getLinkStatusCW: patientV2.getLinkStatusCW,
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
