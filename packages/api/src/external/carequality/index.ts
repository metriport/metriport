import * as patient from "./patient";

const cqCommands = {
  patient: {
    discover: patient.discover,
    remove: patient.remove,
    getCQData: patient.getCQData,
  },
};

export default cqCommands;
