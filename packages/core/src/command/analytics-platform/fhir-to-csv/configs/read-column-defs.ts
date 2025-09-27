import fs from "fs";
import ini from "ini";

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
