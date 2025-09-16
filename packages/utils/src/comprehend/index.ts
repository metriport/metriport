#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import rxnorm from "./rxnorm";
import interactive from "./interactive";
import buildTest from "./build-test";
import buildAllTests from "./build-all-tests";
import findCandidates from "./find-candidates";
import testAgent from "./test-agent";

/**
 * This is the main command registry for the Comprehend CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();
program.addCommand(rxnorm);
program.addCommand(interactive);
program.addCommand(buildTest);
program.addCommand(buildAllTests);
program.addCommand(findCandidates);
program.addCommand(testAgent);
program.parse(process.argv);
