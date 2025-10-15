#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import extractDocument from "./extract-document";
import listPatients from "./list-patients";
import listDocumentsPerPatient from "./list-documents-per-patient";
import downloadPatientDocument from "./download-patient-document";
import parseUnstructuredData from "./parse-unstructured-data";
import test from "./test";
// import getDocument from "./get-document";
// import getDocument from "./get-document";

/**
 * This is the main command registry for the SDE CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();

program.addCommand(listPatients);
program.addCommand(extractDocument);
program.addCommand(listDocumentsPerPatient);
program.addCommand(downloadPatientDocument);
program.addCommand(parseUnstructuredData);
program.addCommand(test);

// program.addCommand(getDocument);
// program.addCommand(getDocument);
// program.addCommand(extractDocument);
program.parse(process.argv);
