import { program } from "commander";
import searchBundle from "./search-bundle";

program.addCommand(searchBundle);
program.parse(process.argv);
