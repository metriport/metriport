#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import rxnorm from "./rxnorm";

/**
 * This is the main command registry for the Comprehend CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();
program.addCommand(rxnorm);
program.parse(process.argv);
