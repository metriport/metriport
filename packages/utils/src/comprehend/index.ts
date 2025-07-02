#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import comprehendBundle from "./comprehend-bundle";
import cacheOutput from "./cache-output";
import testLLM from "./test-llm";

const program = new Command();
program.addCommand(comprehendBundle);
program.addCommand(cacheOutput);
program.addCommand(testLLM);
program.parse(process.argv);
