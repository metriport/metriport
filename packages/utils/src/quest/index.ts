#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Config } from "@metriport/core/util/config";
import { Command } from "commander";
import convertPatientResponse from "./convert-patient-response";
import ingestAllResponses from "./ingest-all-responses";
import sftpAction from "./sftp-action";
import uploadRoster from "./upload-roster";

/**
 * This is the main Quest CLI, which registers all Quest utility commands.
 */
const program = new Command();
FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

program.addCommand(sftpAction);
program.addCommand(uploadRoster);
program.addCommand(ingestAllResponses);
program.addCommand(convertPatientResponse);
program.parse();
