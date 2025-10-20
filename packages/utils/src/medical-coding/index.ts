#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import buildHccMap from "./build-hcc-map";
import buildUcumMap from "./build-ucum-map";

/**
 * This is the command registry for scripts related to building in-memory healthcare coding maps.
 */
const program = new Command();
program.addCommand(buildHccMap);
program.addCommand(buildUcumMap);
program.parse(process.argv);
