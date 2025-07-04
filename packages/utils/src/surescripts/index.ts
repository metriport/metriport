#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import sftpAction from "./sftp-action";
import sendPatientRequest from "./send-patient-request";
import sendBatchRequest from "./send-batch-request";
import verifyRequestInHistory from "./verify-request-in-history";
import receiveResponse from "./receive-response";
import receiveVerification from "./receive-verification";
import convertResponse from "./convert-response";
import convertCustomerResponse from "./convert-customer-response";
import analysis from "./analysis";
import analyzeResponses from "./analyze-responses";
import batchAnalysis from "./batch-analysis";
import preview from "./preview";
import findLargest from "./find-largest";
import bundleVerification from "./bundle-verification";
import drFirst from "./compare/dr-first";

const program = new Command();
program.addCommand(sftpAction);
program.addCommand(sendPatientRequest);
program.addCommand(sendBatchRequest);
program.addCommand(verifyRequestInHistory);
program.addCommand(receiveResponse);
program.addCommand(receiveVerification);
program.addCommand(convertResponse);
program.addCommand(convertCustomerResponse);
program.addCommand(analysis);
program.addCommand(batchAnalysis);
program.addCommand(analyzeResponses);
program.addCommand(preview);
program.addCommand(findLargest);
program.addCommand(bundleVerification);
program.addCommand(drFirst);
program.parse();
