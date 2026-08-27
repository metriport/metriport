import fs from "fs";
import ini from "ini";
import { parseTableNameFromConfigurationFileName } from "../file-name";
import { MetriportError } from "@metriport/shared";

const COLUMN_NAME_BYTE_LIMIT = 63;

export function parseConfigsIntoColumnsByTableName(iniFolder: string): Record<string, string[]> {
  const iniFiles = getIniFiles(iniFolder);
  const columnsByTableName: Record<string, string[]> = {};

  for (const iniFile of iniFiles) {
    const tableName = parseTableNameFromConfigurationFileName(iniFile);
    const columns = getColumnsFromIniFile(`${iniFolder}/${iniFile}`);
    const truncatedColumns = columns.map(column => truncateToBytes(column, COLUMN_NAME_BYTE_LIMIT));
    const uniqueTruncatedColumns = [...new Set(truncatedColumns)];
    if (uniqueTruncatedColumns.length !== columns.length) {
      throw new MetriportError(`Duplicate column names found in ${iniFile}`, undefined, {
        tableName,
        columns: columns.join(", "),
        truncatedColumns: truncatedColumns.join(", "),
        uniqueTruncatedColumns: uniqueTruncatedColumns.join(", "),
      });
    }
    columnsByTableName[tableName] = truncatedColumns;
  }

  return columnsByTableName;
}

function truncateToBytes(str: string, maxBytes: number): string {
  const buffer = Buffer.from(str, "utf8");
  if (buffer.length <= maxBytes) return str;
  const truncated = buffer.subarray(0, maxBytes);
  // Decode back to string, which handles incomplete multi-byte characters by replacing them
  return truncated.toString("utf8").replace(/\uFFFD$/, "");
}

function getIniFiles(iniFolder: string): string[] {
  const files = fs.readdirSync(iniFolder);
  return files.filter(file => file.endsWith(".ini"));
}

function getColumnsFromIniFile(iniFilePath: string): string[] {
  const data = fs.readFileSync(iniFilePath, "utf8");
  const config = ini.parse(data);

  const structSection = config.Struct;
  if (!structSection) {
    throw new Error("No [Struct] section found in the INI file");
  }

  return Object.keys(structSection);
}

// TODO ENG-1818: Remove this function once we have a proper way to read the column definitions for scripts
export function readConfigs(iniFolder: string): Record<string, string> {
  const files = fs.readdirSync(iniFolder);
  const iniFiles = files.filter(file => file.endsWith(".ini"));
  const columnDefs: Record<string, string> = {};

  for (const file of iniFiles) {
    const columns = readIniFile(`${iniFolder}/${file}`);
    const resourceType = file.split("_").slice(1).join("_")?.replace(".ini", "")?.toLowerCase();
    if (!resourceType) {
      throw new Error(`Invalid resource type in file: ${file}`);
    }
    columnDefs[resourceType] = columns.map(column => `${column} VARCHAR`).join(", ");
  }

  return columnDefs;
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
