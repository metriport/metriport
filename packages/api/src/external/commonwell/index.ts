import * as linkV2 from "../commonwell-v2/link";
import * as patient from "./patient/patient";

const cwCommands = {
  patient: {
    create: patient.create,
    update: patient.update,
    remove: patient.remove,
  },
  link: {
    getV2: linkV2.get,
  },
};

export default cwCommands;
