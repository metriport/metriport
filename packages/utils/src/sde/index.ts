#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import extractDocument from "./extract-document";
// import listDocuments from "./list-documents";
// import getDocument from "./get-document";

/**
 * This is the main command registry for the SDE CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();

// program.addCommand(listDocuments);
// program.addCommand(getDocument);
program.addCommand(extractDocument);

program.parse(process.argv);
