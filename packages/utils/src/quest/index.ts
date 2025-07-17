#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import sendPatientRequest from "./send-patient-request";
import sendBatchRequest from "./send-batch-request";
import receiveResponse from "./receive-response";
import { buildSftpAction } from "../shared/sftp-action";
import { QuestSftpClient } from "@metriport/core/external/quest/client";

const program = new Command();
program.addCommand(sendPatientRequest);
program.addCommand(sendBatchRequest);
program.addCommand(receiveResponse);

const sftpAction = buildSftpAction(
  new QuestSftpClient({
    logLevel: "debug",
  })
);
program.addCommand(sftpAction);

program.parse();
