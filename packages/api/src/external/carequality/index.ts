import * as patient from "./patient";

const cqCommands = {
  patient: {
    discover: patient.discover,
    remove: patient.remove,
  },
};

export default cqCommands;
