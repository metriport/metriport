import { Command } from "commander";

const program = new Command();

import connect from "./connect";
import sendPatientLoadFile from "./send-patient-load-file";
import receiveFlatFileResponse from "./receive-flat-file-response";
import receiveVerificationResponse from "./receive-verification-response";

program.addCommand(connect);
program.addCommand(sendPatientLoadFile);
program.addCommand(receiveFlatFileResponse);
program.addCommand(receiveVerificationResponse);
program.addCommand(sendPatientLoadFile);

program.parse();
