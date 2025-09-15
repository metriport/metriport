#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import rxnorm from "./rxnorm";
import interactive from "./interactive";
import buildTest from "./build-test";
import rebuildAllTests from "./rebuild-all-tests";
import findCandidates from "./find-candidates";

/**
 * This is the main command registry for the Comprehend CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();
program.addCommand(rxnorm);
program.addCommand(interactive);
program.addCommand(buildTest);
program.addCommand(rebuildAllTests);
program.addCommand(findCandidates);
program.parse(process.argv);
