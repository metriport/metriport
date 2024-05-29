import * as patient from "./patient";

const cqCommands = {
  patient: {
    discover: patient.discover,
    remove: patient.remove,
    getData: patient.getCQData,
  },
};

export default cqCommands;
