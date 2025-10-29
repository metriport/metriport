import * as link from "../commonwell-v2/link";
import * as patient from "./patient/patient";

const cwCommands = {
  patient: {
    create: patient.create,
    update: patient.update,
    remove: patient.remove,
  },
  link: {
    get: link.get,
  },
};

export default cwCommands;
