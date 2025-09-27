import fs from "fs";
import ini from "ini";
import { parseResourceTypeFromConfigurationFileName } from "../file-name";

/**
 * Returns the list of resource types from the configuration files.
 *
 * @param iniFolder
 * @returns List of resource types.
 */
export function getResourceTypesFromConfigurationFiles(iniFolder: string): string[] {
  const iniFiles = getIniFiles(iniFolder);
  const resourceTypes = iniFiles.map(parseResourceTypeFromConfigurationFileName);
  return resourceTypes;
}

/**
 * Returns the column definitions for each resource type from the configuration files.
 *
 * @param iniFolder
 * @returns Record with resource type as key and column definitions as value.
 */
export function readConfigs(iniFolder: string): Record<string, string> {
  const iniFiles = getIniFiles(iniFolder);
  const columnDefs: Record<string, string> = {};

  for (const file of iniFiles) {
    const resourceType = parseResourceTypeFromConfigurationFileName(file);
    const columns = readIniFile(`${iniFolder}/${file}`);
    columnDefs[resourceType] = columns.map(column => `${column} VARCHAR`).join(", ");
  }

  return columnDefs;
}

function getIniFiles(iniFolder: string): string[] {
  const files = fs.readdirSync(iniFolder);
  return files.filter(file => file.endsWith(".ini"));
}

function readIniFile(path: string): string[] {
  const data = fs.readFileSync(path, "utf8");
  const config = ini.parse(data);

  // Extract properties from the [Struct] section
  const structSection = config.Struct;
  if (!structSection) {
    throw new Error("No [Struct] section found in the INI file");
  }

  // Return the list of property names (keys) from the Struct section
  return Object.keys(structSection);
}
