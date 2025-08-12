#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import sftpAction from "./sftp-action";
import sendPatientRequest from "./send-patient-request";
import sendBatchRequest from "./send-batch-request";
import sendFacilityRequest from "./send-facility-request";
import verifyRequestInHistory from "./verify-request-in-history";
import receiveResponse from "./receive-response";
import receiveVerification from "./receive-verification";
import convertResponse from "./convert-response";
import convertCustomerResponse from "./convert-customer-response";
import convertResponseToCsv from "./convert-response-to-csv";
import analysis from "./analysis";
import analyzeResponses from "./analyze-responses";
import batchAnalysis from "./batch-analysis";
import preview from "./preview";
import findLargest from "./find-largest";
import bundleVerification from "./bundle-verification";
import generateCsv from "./generate-csv";

/**
 * This is the main command registry for the Surescripts CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();

/**
 * Test an SFTP connection to Surescripts. Will only work if it is being run from a server
 * within the VPC corresponding to the environment you are testing (production or staging).
 * npm run surescripts -- sftp connect
 */
program.addCommand(sftpAction);
program.addCommand(sendPatientRequest);
program.addCommand(sendBatchRequest);
program.addCommand(sendFacilityRequest);
program.addCommand(verifyRequestInHistory);
program.addCommand(receiveResponse);
program.addCommand(receiveVerification);
program.addCommand(convertResponse);
program.addCommand(convertCustomerResponse);
program.addCommand(convertResponseToCsv);
program.addCommand(analysis);
program.addCommand(batchAnalysis);
program.addCommand(analyzeResponses);
program.addCommand(preview);
program.addCommand(findLargest);
program.addCommand(bundleVerification);
program.addCommand(generateCsv);
program.parse();
