import { Command } from "commander";
import { readHccSource } from "./shared";

/**
 * Builds a mapping of ICD-10 codes to HCCs by reading from the HCC source file.
 */
const command = new Command();
command.name("build-hcc-map");
command.option("--year <year>", "The year of HCC source to use (default 2025)");

command.action(async ({ year = "2025" }) => {
  const hccMap = await readHccSource(year);
  console.log(hccMap.length);
});

export default command;
