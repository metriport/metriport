#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import modelConversation from "./model-conversation";
import agentConversation from "./agent-conversation";
import agentWithTools from "./agent-with-tools";

/**
 * This is the main command registry for the OpenAI CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();
program.addCommand(modelConversation);
program.addCommand(agentConversation);
program.addCommand(agentWithTools);
program.parse(process.argv);
