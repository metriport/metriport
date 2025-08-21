#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { buildSftpAction } from "../shared/sftp-action";
import uploadRoster from "./upload-roster";
import downloadResponse from "./download-response";
import { QuestSftpClient } from "@metriport/core/external/quest/client";

/**
 * This is the main Quest CLI, which registers all Quest utility commands.
 */
const program = new Command();
const sftpAction = buildSftpAction(
  new QuestSftpClient({
    logLevel: "debug",
  })
);
program.addCommand(sftpAction);
program.addCommand(uploadRoster);
program.addCommand(downloadResponse);
program.parse();
