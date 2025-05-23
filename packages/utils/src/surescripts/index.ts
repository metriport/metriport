import { Command } from "commander";

const program = new Command();

import connect from "./connect";
import synchronize from "./synchronize";
import generatePatientLoadFile from "./generate-patient-load-file";
import receiveFlatFileResponse from "./receive-flat-file-response";
import receiveVerificationResponse from "./receive-verification-response";

program.addCommand(connect);
program.addCommand(synchronize);
program.addCommand(generatePatientLoadFile);
program.addCommand(receiveFlatFileResponse);
program.addCommand(receiveVerificationResponse);

program.parse();
