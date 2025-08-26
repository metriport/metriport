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
import * as patientV1 from "../commonwell-v1/patient";
import * as patient from "./patient/patient";

const cwCommands = {
  organization: {
    createOrUpdate: organization.createOrUpdateCWOrganization,
  },
  patient: {
    create: patient.create,
    get: patientV1.get,
    update: patient.update,
    remove: patient.remove,
    getLinkStatusCQ: patientV1.getLinkStatusCQ,
    getLinkStatusCW: patientV1.getLinkStatusCW,
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
