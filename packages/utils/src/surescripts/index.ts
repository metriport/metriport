import { Command } from "commander";
import sftpAction from "./sftp-action";
import sendPatientRequest from "./send-patient-request";
import sendBatchRequest from "./send-batch-request";
import receiveResponse from "./receive-response";
import receiveVerification from "./receive-verification";

const program = new Command();
program.addCommand(sftpAction);
program.addCommand(sendPatientRequest);
program.addCommand(sendBatchRequest);
program.addCommand(receiveResponse);
program.addCommand(receiveVerification);
program.parse();
