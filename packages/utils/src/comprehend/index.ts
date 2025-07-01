import { Command } from "commander";
import comprehendBundle from "./comprehend-bundle";

const program = new Command();
program.addCommand(comprehendBundle);
program.parse(process.argv);
