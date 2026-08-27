#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Config } from "@metriport/core/util/config";
import { Command } from "commander";
import convertBatchResponse from "./convert-batch-response";
import convertPatientResponse from "./convert-patient-response";
import ingestAllResponses from "./ingest-all-responses";
import sftpAction from "./sftp-action";
import uploadRoster from "./upload-roster";

/**
 * This is the main command registry for the Surescripts CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();
FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

program.addCommand(sftpAction);
program.addCommand(uploadRoster);
program.addCommand(ingestAllResponses);
program.addCommand(convertBatchResponse);
program.addCommand(convertPatientResponse);
program.parse();
