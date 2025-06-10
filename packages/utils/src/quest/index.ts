import { Command } from "commander";
import sftpAction from "./sftp-action";
import generateRequest from "./generate-request";
import receiveResponse from "./receive-response";

const program = new Command();
program.addCommand(sftpAction);
program.addCommand(generateRequest);
program.addCommand(receiveResponse);
program.parse();
