#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import extractDocument from "./extract-document";
import listPatients from "./list-patients";
import listDocumentsPerPatient from "./list-documents";
import downloadDocuments from "./download-documents";
import searchDocuments from "./search-documents";

/**
 * This is the main command registry for the SDE CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();

program.addCommand(listPatients);
program.addCommand(extractDocument);
program.addCommand(listDocumentsPerPatient);
program.addCommand(downloadDocuments);
program.addCommand(searchDocuments);
program.parse(process.argv);
