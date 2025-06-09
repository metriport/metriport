import { Command } from "commander";
import sftpAction from "./sftp-action";
import sendRequest from "./send-request";
import receiveResponse from "./receive-response";

const program = new Command();
program.addCommand(sftpAction);
program.addCommand(sendRequest);
program.addCommand(receiveResponse);
program.parse();
